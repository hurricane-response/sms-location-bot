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

/* Setup constants from environment variable parameters */
const apiRoot = process.env.DATA_API_ROOT_URL;
const dataPaths = {
  shelters: process.env.SHELTERS_PATH || '/shelters/geo.json',
  distribution_points: process.env.PODS_PATH || '/distribution_points/geo.json'
};
const mileRadius = process.env.MILE_RADIUS || 30;

/* Setup DataUpdater to periodically retrieve new location data */
let locationData = {
  shelters: new Map(),
  distribution_points: new Map()
}; // actually fetched at server startup
import DataUpdater from './data_updater';
const updater = new DataUpdater(apiRoot, dataPaths);

/* Setup SheltersFinder with dummy locationData */
import SheltersFinder from './shelters_finder';
const sheltersFinder = new SheltersFinder(locationData, mileRadius);

/* Setup PODsFinder with dummy locationData */
import PODsFinder from './pods_finder';
const podsFinder = new PODsFinder(locationData, mileRadius);

/* Handle update event on the DataUpdater */
updater.on('update', (data) => {
  console.log(`EVENT DataUpdater#update: Received ${Object.keys(data).length} new/refreshed data sets: {${Object.entries(data).map(([label, dataset]) => `${label}: ${dataset.size} zip codes`).join(', ')}}.`);
  locationData = data;
  sheltersFinder.updateLocationData(data.shelters);
  podsFinder.updateLocationData(data.distribution_points);
  console.log('Data update successful.');
});

/* Periodically retrieve location data from upstream API at DATA_URL
   Note that updater.fetchLocationsData() returns data via the 'update'
   event, so there's no need for a .then() handler here. */
const startLocationsUpdate = function () {
  try {
    updater.performUpdate()
  } catch (e) {
    console.error(`ERROR updating location data: ${e}\nStack trace:\n${e.stack}`);
    if (locationData.size === 0) { process.exit(1); }
  }
};
startLocationsUpdate();
const minutesInMS = 60000;
const refreshTimer = setInterval(
  startLocationsUpdate.bind(this),
  5 * minutesInMS
);
/* Clear periodic refreshes on process exit */
process.on('exit', () => clearInterval(refreshTimer));

/* Setup app */
export const app = express();

import ZipcodeExtractor from './zipcode_extractor';
import TwilioFormatter from './twilio_formatter';
const zipcodeExtractor = new ZipcodeExtractor();
const twilioFormatter = new TwilioFormatter();

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
    for (let msg of podsFinder.findPODs(sentZipcodes)) {
      responseMessages.push(msg);
    }
  }
  const twimlResponse = twilioFormatter.format(responseMessages);

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twimlResponse.toString());
});

http.createServer(app).listen(process.env.PORT, () => {
  console.log(`Express server listening on: ${process.env.PORT}`);
});

export default app;
