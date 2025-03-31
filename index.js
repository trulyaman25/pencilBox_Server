import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    auth0Id: { 
        type: String, 
        required: true
    },
    firstName: { 
        type: String, 
        required: true, 
        trim: true
    },
    lastName: { 
        type: String, 
        required: true, 
        trim: true
    },
    username: { 
        type: String, 
        required: true, 
        trim: true,
        unique: true
    },
    email: { 
        type: String, 
        required: true, 
        trim: true 
    },
    phone: { 
        type: String, 
        required: true,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    alternativePhone: { 
        type: String,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    addressLine1: { 
        type: String,
        required: true,
        trim: true
    },
    addressLine2: { 
        type: String, 
        required: true, 
        trim: true
    },
    city: { 
        type: String,
        required: true,
        trim: true
    },
    state: { 
        type: String, 
        required: true, 
        trim: true 
    },
    pincode: { 
        type: String, 
        required: true,
        match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit pincode']
    },
    landmark: { 
        type: String, 
        trim: true 
    },
    profileCompleted: { 
        type: Boolean, 
        default: false 
    }
});

const User = mongoose.model('User', userSchema);

const bookingSchema = new mongoose.Schema({
    firstName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    lastName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    phone: { 
        type: String, 
        required: true,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    date: { 
        type: String, 
        required: true 
    },
    timeSlot: { 
        type: String, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const Booking = mongoose.model('Booking', bookingSchema);

const contactSchema = new mongoose.Schema({
    firstName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    lastName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        trim: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const Contact = mongoose.model('Contact', contactSchema);

app.post('/api/contact', async (req, res) => {
    try {
        const contactData = new Contact(req.body);
        await contactData.save();
        res.status(201).json({ message: 'Message sent successfully' });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: 'Please fill all required fields' });
        }
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.post('/api/booking', async (req, res) => {
    try {
        const bookingData = new Booking(req.body);
        await bookingData.save();
        res.status(201).json({ message: 'Booking successful' });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: 'Please fill all required fields correctly' });
        }
        res.status(500).json({ error: 'Failed to book call' });
    }
});

const validateMandatoryFields = (userData) => {
    const mandatoryFields = [
        'firstName',
        'lastName',
        'username',
        'phone',
        'addressLine1',
        'addressLine2',
        'city',
        'state',
        'pincode'
    ];

    const isValid = mandatoryFields.every(field => {
        const value = userData[field]?.trim();
        if (!value) return false;
        
        if (field === 'phone' && !/^[0-9]{10}$/.test(value)) return false;
        if (field === 'pincode' && !/^[0-9]{6}$/.test(value)) return false;
        
        return true;
    });

    return isValid;
};

app.get('/api/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const existingUser = await User.findOne({ username });
        res.json({ 
            available: !existingUser,
            currentUser: existingUser?.auth0Id === req.query.auth0Id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/profile', async (req, res) => {
    try {
        const userData = req.body;
        
        if (!userData.auth0Id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const existingUser = await User.findOne({ 
            username: userData.username,
            auth0Id: { $ne: userData.auth0Id }
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: 'Username is already taken'
            });
        }

        const isProfileComplete = validateMandatoryFields(userData);
        userData.profileCompleted = isProfileComplete;

        const user = await User.findOneAndUpdate(
            { auth0Id: userData.auth0Id },
            { ...userData },
            { 
                new: true,
                upsert: true,
                runValidators: true
            }
        );
        
        res.json(user);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ error: errors });
        }
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/profile/:auth0Id', async (req, res) => {
    try {
        const user = await User.findOne({ auth0Id: req.params.auth0Id });
        res.json(user || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));