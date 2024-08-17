// importing
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cloudinary = require('cloudinary');
const acceptMultimedia = require('connect-multiparty');
const connectDB = require('./database/database');
const session = require('express-session'); 
const MongoStore = require('connect-mongo'); 
const upload = require('./multer_config');
const { AuditLog } = require('./auditLogger');

// Making express app
const app = express();

// dotenv config
dotenv.config();

// cloudinary config
cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(acceptMultimedia());
app.use(express.urlencoded({ extended: true }));

// cors config to accept request from frontend
const corsOptions = {
    origin: true,
    credentials: true,
    optionSuccessStatus: 200
};
app.use(cors(corsOptions));

// mongodb connection
connectDB();

// Accepting json data
app.use(express.json());

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false, 
    store: MongoStore.create({ 
        mongoUrl: process.env.DB_URL, 
        ttl: 14 * 24 * 60 * 60
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true,
        sameSite: 'strict', 
        maxAge: 14 * 24 * 60 * 60 * 1000 
    }
}));


// creating test route
app.get("/test", (req, res) => {
    res.status(200).send("Hello");
});

app.use('/api/user', require('./routes/userRoutes'));

app.use('/api/data', require('./routes/dataRoutes'));

app.get('/api/audit-logs', async (req, res) => {
    try {
      const logs = await AuditLog.find().sort({ timestamp: -1 });
      res.json(logs);
    } catch (err) {
      res.status(500).send('Server error');
    }
});

app.use('/api', require('./routes/authRoutes'));


// defining port
const PORT = process.env.PORT;
// run the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// exporting app
module.exports = app;
