import {
  verifierCreateDSRC,
  MAX_URI_LENGTH,
  BASIS_POINTS,
  MAX_RECIPIENTS,
} from "../services/contracts/hitmakrdsrcfactory/hitmakrDSRCFactory.js";
import DSRC from "../models/DSRC.js";
import Song from "../models/Song.js";
import { isAddress } from "ethers";

export async function createDSRC(req, res) {
  try {
    const userAddress = req.headers["x-user-address"];
    const dsrcData = req.body;

    console.log("Raw request body received from client:", req.body);
    console.log("Creating DSRC with data:", { ...dsrcData });

    if (!isAddress(userAddress)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user address" });
    }

    const {
      tokenURI,
      uploadHash,
      collectorsPrice,
      licensingPrice,
      recipients,
      percentages,
      selectedChain,
    } = dsrcData;

    if (
      !tokenURI ||
      !uploadHash ||
      !recipients ||
      !percentages ||
      !Array.isArray(recipients) ||
      !Array.isArray(percentages) ||
      !selectedChain
    ) {
      console.log("Missing parameters:", {
        tokenURI: !!tokenURI,
        uploadHash: !!uploadHash,
        recipients: !!recipients && Array.isArray(recipients),
        percentages: !!percentages && Array.isArray(percentages),
        selectedChain: !!selectedChain,
      });
      return res
        .status(400)
        .json({ success: false, message: "Missing required parameters" });
    }

    if (tokenURI.length > MAX_URI_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Token URI exceeds maximum length of ${MAX_URI_LENGTH} characters`,
      });
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_RECIPIENTS} recipients allowed`,
      });
    }

    if (recipients[0]?.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "First recipient must be the creator address",
      });
    }

    const totalPercentage = percentages.reduce((sum, p) => sum + Number(p), 0);
    if (totalPercentage !== BASIS_POINTS) {
      return res.status(400).json({
        success: false,
        message: `Total percentage must equal exactly ${BASIS_POINTS} (100%), got ${totalPercentage}`,
      });
    }

    if (isNaN(collectorsPrice) || isNaN(licensingPrice)) {
      return res.status(400).json({
        success: false,
        message: "Invalid edition prices. Prices must be valid numbers.",
      });
    }

    const formattedCollectorsPrice = collectorsPrice?.toString() || "0";
    const formattedLicensingPrice = licensingPrice?.toString() || "0";

    if (
      BigInt(formattedCollectorsPrice) < 0 ||
      BigInt(formattedLicensingPrice) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Edition prices cannot be negative.",
      });
    }

    if (
      BigInt(formattedCollectorsPrice) === 0n &&
      BigInt(formattedLicensingPrice) === 0n
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one edition price must be greater than 0.",
      });
    }

    const song = await Song.findOne({ uploadHash });
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Song not found with the provided uploadHash",
      });
    }

    const formattedDsrcData = {
      tokenURI,
      collectorsPrice: formattedCollectorsPrice,
      licensingPrice: formattedLicensingPrice,
      recipients,
      percentages,
      selectedChain,
    };

    console.log("Data being sent to contract:", formattedDsrcData);

    const createResult = await verifierCreateDSRC(formattedDsrcData);
    if (!createResult.success) {
      return res.status(500).json({
        success: false,
        message: createResult.error,
        details: createResult.details,
      });
    }

    const dsrc = new DSRC({
      dsrcId: createResult.dsrcId,
      creator: userAddress,
      contractAddress: createResult.dsrcAddress,
      chain: selectedChain,
      tokenURI,
      collectorsPrice: formattedCollectorsPrice,
      licensingPrice: formattedLicensingPrice,
      recipients: recipients.map((address, index) => ({
        address,
        percentage: Number(percentages[index]),
      })),
      createdAt: Math.floor(Date.now() / 1000),
    });

    await dsrc.save();

    if (!song.chainDsrcs) {
      song.chainDsrcs = new Map();
    }

    const dsrcInfo = {
      dsrcId: createResult.dsrcId,
      dsrcAddress: createResult.dsrcAddress,
      transactionHash: createResult.transactionHash,
    };

    song.chainDsrcs.set(selectedChain, dsrcInfo);

    await Song.findOneAndUpdate(
      { uploadHash },
      {
        $set: {
          dsrc: createResult.dsrcAddress,
          dsrcId: createResult.dsrcId,
          dsrcAddress: createResult.dsrcAddress,
          chainDsrcs: song.chainDsrcs,
        },
      },
      { new: true }
    );

    res.json({
      success: true,
      data: {
        dsrcId: createResult.dsrcId,
        contractAddress: createResult.dsrcAddress,
        transactionHash: createResult.transactionHash,
      },
    });
  } catch (error) {
    console.error("CreateDSRC error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getDSRCById(req, res) {
  try {
    const { dsrcId } = req.params;
    const dsrc = await DSRC.findOne({ dsrcId });

    if (!dsrc) {
      return res.status(404).json({
        success: false,
        message: "DSRC not found",
      });
    }

    res.json({
      success: true,
      data: dsrc,
    });
  } catch (error) {
    console.error("GetDSRCById error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getDSRCsByCreator(req, res) {
  try {
    const { creator } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!isAddress(creator)) {
      return res.status(400).json({
        success: false,
        message: "Invalid creator address",
      });
    }

    const totalDSRCs = await DSRC.countDocuments({
      creator: creator.toLowerCase(),
    });

    const dsrcs = await DSRC.find({ creator: creator.toLowerCase() })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: {
        dsrcs,
        pagination: {
          total: totalDSRCs,
          page,
          pages: Math.ceil(totalDSRCs / limit),
          hasMore: skip + dsrcs.length < totalDSRCs,
        },
      },
    });
  } catch (error) {
    console.error("GetDSRCsByCreator error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getDSRCByAddress(req, res) {
  try {
    const { contractAddress } = req.params;

    if (!isAddress(contractAddress)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract address",
      });
    }

    const dsrc = await DSRC.findOne({
      contractAddress: contractAddress.toLowerCase(),
    });

    if (!dsrc) {
      return res.status(404).json({
        success: false,
        message: "DSRC not found",
      });
    }

    res.json({
      success: true,
      data: dsrc,
    });
  } catch (error) {
    console.error("GetDSRCByAddress error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getDSRCsByChain(req, res) {
  try {
    const { chain } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalDSRCs = await DSRC.countDocuments({ chain });

    const dsrcs = await DSRC.find({ chain })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: {
        dsrcs,
        pagination: {
          total: totalDSRCs,
          page,
          pages: Math.ceil(totalDSRCs / limit),
          hasMore: skip + dsrcs.length < totalDSRCs,
        },
      },
    });
  } catch (error) {
    console.error("GetDSRCsByChain error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
