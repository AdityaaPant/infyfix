import { config } from "dotenv";
import express from "express";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import path from "path";

config();

const app = express();

// set template engine as ejs
app.set("view engine", "ejs");

// Set views directory for serverless (relative to project root)
app.set("views", path.join(process.cwd(), "views"));

// set public folder as static folder
app.use(express.static(path.join(process.cwd(), "public")));

app.use(express.urlencoded({ extended: true }));

// Contact schema
const contactSchema = new mongoose.Schema({
	name: { type: String, required: true },
	email: { type: String, required: true },
	phone: { type: String, required: true },
	subject: { type: String, required: true },
	message: { type: String, required: true },
	status: { type: String, required: true, default: "pending" },
});

const Contact = mongoose.model("Contact", contactSchema);

// nodemailer setup

const transport = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: process.env.SMTP_PORT,
	secure: false,
	auth: {
		user: process.env.SMTP_USERNAME,
		pass: process.env.SMTP_PASSWORD,
	},
});

const sendMail = async (to, subject, text) => {
	await transport.sendMail({
		from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
		to,
		subject,
		html: text,
	});
};

// get all contacts
// update status
// delete contact

const createContactHandler = async (req, res) => {
	try {
		const { name, email, phone, subject, message } = req.body;

		// crate contact
		const createdContact = await Contact.create({
			name,
			email,
			phone,
			subject,
			message,
		});

		// send mail to admin
		sendMail(
			process.env.ADMIN_EMAIL,
			`New contact request: ${createdContact.subject}`,
			`You have received a new contact from <strong>${createdContact.name}</strong> with email <strong>${createdContact.email}</strong><br /> ${createdContact.message}`
		);

		// send mail to user
		sendMail(
			createdContact.email,
			`Contact request received successfully`,
			`Thank you for contacting us. We will get back to you soon.`
		);

		return res.redirect("/contact?success=true");
	} catch (err) {
		console.log(err);

		// TODO: show error on contact page
		res.send("Something went wrong");
	}
};

const updateContactStatusHandler = async (req, res) => {
	try {
		const { id } = req.body;

		await Contact.findByIdAndUpdate(id, {
			status: "completed",
		});

		return res.redirect("/admin/contact");
	} catch (err) {
		res.send("Something went wrong");
	}
};

const deleteContactHandler = async (req, res) => {
	try {
		const { id } = req.body;

		await Contact.findByIdAndDelete(id);

		return res.redirect("/admin/contact");
	} catch (err) {
		res.send("Something went wrong");
	}
};

app.get("/", (req, res) => {
	res.render("index");
});

app.post("/contact", createContactHandler);

app.get("/contact", (req, res) => {
	const { success } = req.query;

	res.render("contact", {
		success,
	});
});

app.get("/services", (req, res) => {
	res.render("services");
});

app.post("/admin/contact/update", updateContactStatusHandler);
app.post("/admin/contact/delete", deleteContactHandler);

app.get("/admin/contact", async (req, res) => {
	// get all contacts from database
	const contacts = await Contact.find({});

	return res.render("contactAdmin", {
		contacts: contacts || [],
	});
});

app.get("/about", (req, res) => {
	res.render("about");
});

const runServer = async () => {
	try {
		if (!process.env.DB_URI) {
			console.log(
				"Warning: DB_URI not found. Database features will be disabled."
			);
			return;
		}
		await mongoose.connect(process.env.DB_URI);
		console.log("Database connected");
	} catch (error) {
		console.error("Database connection error:", error);
	}
};

// Initialize database connection
runServer();

// Add error handling for routes
app.use((err, req, res, next) => {
	console.error("Error:", err);
	res.status(500).send("Internal Server Error: " + err.message);
});

// For local development
if (process.env.NODE_ENV !== "production") {
	const PORT = process.env.PORT || 8000;
	app.listen(PORT, () => {
		console.log(`Server is running on port ${PORT}`);
	});
}

export default app;
