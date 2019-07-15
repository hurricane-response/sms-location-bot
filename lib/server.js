import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';

/* Monitor for blocking of main event loop */
import blocked from 'blocked-at';
blocked((time, stack) => {
  if (time > 100) {
    console.log(`Blocked for ${time}ms, operation started here:`, stack);
  }
});

/* Periodically retrieve location data from upstream API at DATA_URL */
import DataUpdater from './data_updater.js';
const updater = new DataUpdater(process.env.DATA_URL);
let locationData = new Map(); // actually fetched at server startup
updater.on('update', (data) => {
  console.log(`EVENT DataUpdater#update: Received new data covering ${data.size} zip codes.`);
  locationData = data;
  sheltersFinder = new SheltersFinder(locationData);
  console.log('Data update successful.');
});
const startLocationsUpdate = function () {
  updater.fetchLocationData().catch((e) => {
    console.error(`ERROR updating location data: ${e}\nStack trace:\n${e.stack}`);
    if (locationData.size === 0) { process.exit(1); }
  });
};
startLocationsUpdate();

/* Setup app */
export const app = express();

import ZipcodeExtractor from './zipcode_extractor';
import SheltersFinder from './shelters_finder';
import TwilioFormatter from './twilio_formatter';
const zipcodeExtractor = new ZipcodeExtractor();
const twilioFormatter = new TwilioFormatter();
let sheltersFinder = new SheltersFinder(locationData);

app.use(bodyParser.urlencoded({extended: false}));
app.post('/sms', (req, res) => {
  const responseMessages = [];
  const sentZipcodes = zipcodeExtractor.extractMessageZipCodes(req.body.Body);
  if(sentZipcodes.length == 0) {
    responseMessages.push('Sorry, I couldn\'t find any ZIP codes in your text message. Please try again.');
  } else {
    for (let msg of sheltersFinder.findShelters(sentZipcodes)) {
      responseMessages.push(msg);
    }
  }
  const twimlResponse = twilioFormatter.format(responseMessages);

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twimlResponse.toString());
});

http.createServer(app).listen(process.env.PORT, () => {
  const minutesInMS = 60000;
  const refreshTimer = setInterval(startLocationsUpdate.bind(this), 5 * minutesInMS);
  process.on('exit', () => clearInterval(refreshTimer));
  console.log(`Express server listening on: ${process.env.PORT}`);
});

export default app;
