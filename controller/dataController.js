const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
const fs = require('fs');
const path = require('path');
const Data = require("../model/dataModel");

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

// Encryption and Decryption Functions
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString("hex"), encryptedData: encrypted.toString("hex") };
}

function decrypt(encryptedData, iv) {
  if (!encryptedData || !iv) {
    console.error('Decryption error: Missing encryptedData or iv.');
    throw new Error('No data provided for decryption.');
  }

  try {
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Decryption failed.');
  }
}

function encryptImage(filePath) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const fileBuffer = fs.readFileSync(filePath);
  let encrypted = cipher.update(fileBuffer);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted.toString('hex')
  };
}

function decryptImage(encryptedData, iv, outputPath) {
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));

  const encryptedBuffer = Buffer.from(encryptedData, 'hex');
  let decrypted = decipher.update(encryptedBuffer);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  fs.writeFileSync(outputPath, decrypted);
}

const createData = async (req, res) => {
  const { fullName, dateOfBirth, address, phoneNumber, email } = req.body;
  const { dataImage } = req.files;

  if (!fullName || !dateOfBirth || !address || !phoneNumber || !email) {
    return res.status(400).json({ success: false, message: "Please fill all the fields" });
  }

  try {
    if (!dataImage || !dataImage.path) {
      throw new Error('File upload failed: dataImage path is missing.');
    }

    const encryptedImage = encryptImage(dataImage.path);
    const uploadedImage = await cloudinary.uploader.upload(dataImage.path, {
      folder: "userData",
      crop: "scale",
    });

    const encryptedFullName = encrypt(fullName);
    const encryptedAddress = encrypt(address);
    const encryptedPhoneNumber = encrypt(phoneNumber);
    const encryptedEmail = encrypt(email);

    const newData = new Data({
      fullName: encryptedFullName.encryptedData,
      fullNameIv: encryptedFullName.iv,
      dateOfBirth: dateOfBirth,
      address: encryptedAddress.encryptedData,
      addressIv: encryptedAddress.iv,
      phoneNumber: encryptedPhoneNumber.encryptedData,
      phoneNumberIv: encryptedPhoneNumber.iv,
      email: encryptedEmail.encryptedData,
      emailIv: encryptedEmail.iv,
      dataImageUrl: uploadedImage.secure_url,
      dataImageEncrypted: encryptedImage.encryptedData,
      dataImageIv: encryptedImage.iv
    });

    await newData.save();

    res.json({
      success: true,
      message: "Data created successfully",
      data: newData,
    });
  } catch (error) {
    console.error('Error in createData:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getData = async (req, res) => {
  try {
    const allData = await Data.find({});
    const decryptedData = allData.map((item) => {
      return {
        _id: item._id,
        fullName: decrypt(item.fullName, item.fullNameIv),
        dateOfBirth: item.dateOfBirth,
        address: decrypt(item.address, item.addressIv),
        phoneNumber: decrypt(item.phoneNumber, item.phoneNumberIv),
        email: decrypt(item.email, item.emailIv),
        dataImageUrl: item.dataImageUrl,
      };
    });

    console.log("Decrypted Data:", decryptedData); // Log decrypted data

    res.json({
      success: true,
      message: "All data fetched successfully!",
      data: decryptedData,
    });
  } catch (error) {
    console.error('Error in getData:', error);
    res.status(500).send("Internal server error");
  }
};


const getSingleData = async (req, res) => {
  const dataId = req.params.id;
  try {
    const singleData = await Data.findById(dataId);
    singleData.fullName = decrypt(singleData.fullName, singleData.fullNameIv);
    singleData.address = decrypt(singleData.address, singleData.addressIv);
    singleData.phoneNumber = decrypt(singleData.phoneNumber, singleData.phoneNumberIv);
    singleData.email = decrypt(singleData.email, singleData.emailIv);

    const tempImagePath = path.join(__dirname, 'tempImage');
    decryptImage(singleData.dataImageEncrypted, singleData.dataImageIv, tempImagePath);
    singleData.dataImageUrl = tempImagePath;

    res.json({
      success: true,
      message: "Single data fetched successfully!",
      data: singleData,
    });
  } catch (error) {
    console.error('Error in getSingleData:', error);
    res.status(500).send("Internal server error");
  }
};

const updatedata = async (req, res) => {
  const { fullName, dateOfBirth, address, phoneNumber, email } = req.body;
  const { dataImage } = req.files;

  if (!fullName || !dateOfBirth || !address || !phoneNumber || !email) {
    return res.json({
      success: false,
      message: "Required fields are missing!",
    });
  }

  try {
    const dataId = req.params.id;

    let updatedData = { dateOfBirth };

    if (dataImage) {
      const uploadedImage = await cloudinary.uploader.upload(dataImage.path, {
        folder: "userData",
        crop: "scale",
      });
      updatedData.dataImageUrl = uploadedImage.secure_url;

      const encryptedImage = encryptImage(dataImage.path);
      updatedData.dataImageEncrypted = encryptedImage.encryptedData;
      updatedData.dataImageIv = encryptedImage.iv;
    }

    if (fullName) {
      const encryptedFullName = encrypt(fullName);
      updatedData.fullName = encryptedFullName.encryptedData;
      updatedData.fullNameIv = encryptedFullName.iv;
    }

    if (address) {
      const encryptedAddress = encrypt(address);
      updatedData.address = encryptedAddress.encryptedData;
      updatedData.addressIv = encryptedAddress.iv;
    }

    if (phoneNumber) {
      const encryptedPhoneNumber = encrypt(phoneNumber);
      updatedData.phoneNumber = encryptedPhoneNumber.encryptedData;
      updatedData.phoneNumberIv = encryptedPhoneNumber.iv;
    }

    if (email) {
      const encryptedEmail = encrypt(email);
      updatedData.email = encryptedEmail.encryptedData;
      updatedData.emailIv = encryptedEmail.iv;
    }

    await Data.findByIdAndUpdate(dataId, updatedData);
    res.json({
      success: true,
      message: dataImage ? "Data updated successfully with Image!" : "Data updated successfully without Image!",
      updatedData: updatedData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deletedata = async (req, res) => {
  const dataId = req.params.id;
  try {
    await Data.findByIdAndDelete(dataId);
    res.json({
      success: true,
      message: "Data deleted successfully!",
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Server error!!",
    });
  }
};

module.exports = {
  createData,
  getData,
  getSingleData,
  updatedata,
  deletedata
};
