require('dotenv').config()
const {
    SHIPPING_EASY_KEY,
    SHIPPING_EASY_SECRET,
    GMAIL_USER,
    GMAIL_PASS,
} = process.env;

const fetch = require('node-fetch')
const express = require('express')
const app = express()
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS,
    }
});


const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

const events = [];

app.get('/', (req, res) => {
    res.send(JSON.stringify(events, null, '\t'));
})

app.post('/orders/canceled', (req, res) => {
    events.push(req.body)
    //sendShipEasyCancelRequest(req.body.name);
    sendEmail({
        subject: 'Order ' + req.body.name + ' has been Canceled!',
        text: 'Order ' + req.body.name + ' has been Canceled. Do not ship this order.'
    });
    res.status(200);
    res.send();
})

app.post('/orders/paid', (req, res) => {
    events.push(req.body)
    //sendShipEasyCancelRequest(req.body.name);
    handleDropshipOrder(req);
    res.status(200);
    res.send();
})

app.listen(3000, () => console.log('Example app listening on port 3000!'))

function handleDropshipOrder(req) {
    let cart = req.body.line_items;
    let foundDropshipItem = false;
    let dropshipItems = [];
    cart.map(item => {
        if (item.sku.includes('(DS)')) {
            foundDropshipItem = true;
            dropshipItems.push(item);
        }
    })
    if (foundDropshipItem)
        sendEmail({
            subject: 'Order ' + req.body.name + ' contains Dropship items!',
            text: 'Order ' + req.body.name + ' contains the following dropship items:\n' +
                Object.values(dropshipItems).map(item => item.quantity + 'x\t' + item.sku + '\t' + item.title + '\n').join(''),
        });
}

function sendShipEasyCancelRequest(id) {
    let fetchOptions = {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        api_key: SHIPPING_EASY_KEY,
        api_timestamp: + new Date(),
    }
    let url = `https://app.shippingeasy.com/api/stores/${SHIPPING_EASY_KEY}/orders/${id}/cancellations`;


    fetch(getShipEasyUrl(fetchOptions, url), { method: 'POST', body: '{}' })
        .then(response => { console.log(response); return response.json() })
        .then(json => {
            //console.log(json);
        })
        .catch(error => {
            console.log(error);
        });
}

function getShipEasyUrl(options, url) {
    let signatureArray = [];

    Object.entries(options).map(opt => {
        switch (opt[0]) {
            case 'body':
                signatureArray.push(opt[1]);
                break;
            case 'method':
            case 'credentials':
            case 'headers':
                //skip
                break;
            default:
                signatureArray.push(opt[0] + '=' + opt[1])
                break;
        }
    });

    let signatureString = encryptShipEasySignature(options.method.toUpperCase() + '&' + url + '&' + signatureArray.join('&'));
    console.log('signatureString:', signatureString);

    let newUrl = url + '&api_key=' + options.api_key + '&api_signature=' + signatureString + '&api_timestamp=' + options.api_timestamp;
    console.log('newUrl:', newUrl);

    return newUrl;
}

function encryptShipEasySignature(string) {
    let hmac = crypto.createHmac('sha256', SHIPPING_EASY_SECRET).update(string).digest('base64');
    console.log(hmac);
    return hmac;
}

function sendEmail(options) {
    const { from = GMAIL_USER, to = 'koipond1220@gmail.com', subject = 'Alert', text = '' } = options;
    transporter.sendMail({
        from,
        to,
        subject,
        text
    }, (error, info) => {
        if (error)
            console.log(error);
        else
            console.log('Email sent: ' + info.response);
    });
}