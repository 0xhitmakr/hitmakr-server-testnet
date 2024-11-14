import mongoose from 'mongoose';

const dsrcSchema = new mongoose.Schema({
    dsrcId: {
        type: String,
        required: true,
        unique: true
    },
    creator: {
        type: String,
        required: true,
        lowercase: true
    },
    contractAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    chain: {
        type: String,
        required: true
    },
    tokenURI: {
        type: String,
        required: true
    },
    price: {
        type: String,
        required: true
    },
    recipients: [{
        address: {
            type: String,
            required: true,
            lowercase: true
        },
        percentage: {
            type: Number,
            required: true
        }
    }],
    createdAt: {
        type: Number,
        required: true
    }
});

export default mongoose.model('DSRC', dsrcSchema);