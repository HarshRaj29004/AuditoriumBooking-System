const express = require("express");
const router = new express.Router();
const User = require("../models/index");
const auth = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const { log } = require("console");
const fileUpload = require('express-fileupload');
const { uploadToCloudinary } = require('../config/cloudinary');
const saltRounds = 10;
require("dotenv").config();
const path = require('path');
const os = require('os');

// Use system temp directory instead of '/tmp/'
const tempDir = os.tmpdir();

// Add file upload middleware
router.use(fileUpload({
  useTempFiles: true,
  tempFileDir: tempDir,
  createParentPath: true,
  debug: true,
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  abortOnLimit: true,
  safeFileNames: true,
  preserveExtension: true
}));

router.post("/createticket", async (req, res) => {
  try {
    const {
      name,
      email,
      mobileno,
      eventdescription,
      date,
      clubname,
      requestType,
      startTime,
      endTime,
    } = req.body;

    // Validate required fields
    if (!name || !email || !mobileno || !eventdescription || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "Please fill up all fields" });
    }

    // Check if file was uploaded
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    const file = req.files.file;

    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: "Only PDF files are allowed" });
    }

    console.log("Uploading file:", {
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      tempFilePath: file.tempFilePath // Log the temp file path
    });

    // Upload file to Cloudinary
    const fileUrl = await uploadToCloudinary(file);
    console.log("File uploaded successfully:", fileUrl);

    const ticket = new User.Ticket({
      name,
      email,
      mobileno,
      eventdescription,
      date: new Date(date),
      clubname: requestType === "club" ? clubname : null,
      requestType,
      status: "pending",
      approvedBy: null,
      file: fileUrl,
      startTime,
      endTime,
    });
    console.log(ticket);
    await ticket.save();
    console.log("🎫 Ticket saved successfully:", ticket);
    
    // Send success response
    res.status(201).json({
      message: "Booking request created successfully",
      ticket
    });
  } catch (err) {
    console.error("Error creating ticket:", err);
    res.status(500).json({ 
      error: "Failed to create a ticket", 
      details: err.message 
    });
  }
});

// Route to update ticket status
router.put("/updateticket/:ticketId", auth(["sub-admin", "super-admin"]), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    const ticket = await User.Ticket.findById(ticketId);
    // console.log(req.body);
    
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (req.user.role === "sub-admin") {
      if (!["booked", "declined", "forwarded"].includes(status)) {
        return res.status(400).json({ error: "Invalid status for sub-admin" });
      }
      if (status === "forwarded") {
        ticket.status = "pending";
        ticket.approvedBy = "sub-admin";
      } else {
        ticket.status = status;
        ticket.approvedBy = "sub-admin";
      }
    }

    if (req.user.role === "super-admin") {
      if (!["booked", "declined"].includes(status)) {
        return res.status(400).json({ error: "Super-admin can only approve or decline" });
      } else {
        ticket.status = status;
        ticket.approvedBy = "super-admin";
      }
    }

    await ticket.save();
    res.json({ message: "Ticket updated successfully", ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update ticket" });
  }
});


// Route to check the status of a ticket
router.get("/ticket", async (req, res) => {
  try {
    const { status,date } = req.query;
    // console.log(req.query);
    if (!status) {
      const tickets = await User.Ticket.find({});
      // console.log(tickets)
      return res.json(tickets);
    }
    const allowedStatuses = ["booked", "declined", "pending"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const tickets = await User.Ticket.find({ date,status });
    // console.log(tickets)
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

const parseRoleEmails = (roleEmailsString) => {
  const roleEmails = {};
  const roleEntries = roleEmailsString.split(';');
  roleEntries.forEach(entry => {
    const [role, emails] = entry.split(':');
    roleEmails[role] = emails.split(',');
  });
  return roleEmails;
};

const roleEmails = parseRoleEmails(process.env.ROLE_EMAILS);

router.post("/Adminregister", async (req, res) => {
  const { email, username, password } = req.body;
  let role;
  try {
    let allowedEmails = false;
    for(const  key in roleEmails){
      if(roleEmails[key].includes(email)){
        role = key;
        allowedEmails = true;
        break;
      }
    }

    if (!allowedEmails) {
      return res.status(403).send("Email not allowed for registration");
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await User.RegistrationUser.create({
      email,
      username,
      password: hashedPassword,
      role: role,
    });
    res.send("Registration Successfully");
  } catch (err) {
    console.error("Registration error:", err);
    res.status(400).send("Registration failed");
  }
});

router.post("/Adminlogin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.RegistrationUser.findOne({ email });
    if (!user) return res.status(400).send("User not found");

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(400).send("Incorrect password");

    const token = await user.generateAuthToken();
    res.json({ token, role: user.role,user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Login failed");
  }
});

module.exports = router;
