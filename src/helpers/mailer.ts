const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for port 465, false for other ports
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// async..await is not allowed in global scope, must use a wrapper
export default async function sendMail(to: string, subject: string, text: string) {
    console.log("Transporter Info", {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false, // true for port 465, false for other ports
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
        }
    })
    // send mail with defined transport object
    const info = await transporter.sendMail({
        from: '"AGPAY V2" <' + process.env.EMAIL + '>', // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        text: text, // plain text body
        html: `<b>${text}</b>`, // html body
    });

    console.log("Message sent: %s", info.messageId);
}

