# Contributing to this Project

## TL;DR: Getting started

Install the API:

```{bash}
nvm use
npm install
```

Run the tests:

```{bash}
npm test
```

Start the API:

```{bash}
DATA_URL="https://api.hurricane-response.org/api/v1/shelters/geo.json" MILE_RADIUS=30 PORT=3000 node -r esm index.js
```

Query the running API's webhook locally via cURL:

```{bash}
curl -XPOST --header "Content-Type: application/x-www-form-urlencoded" --data "Body=I'm in zip code 20149 and 70123" "http://localhost:3000/sms"
```

## Running `sms-location-bot`

`sms-location-bot` is an Express app that can be run via e.g. `node -r esm index.js`, but see configuration documentation below.

It has a `POST` endpoint at `/sms` and is designed to be used as a Twilio [webhook](https://www.twilio.com/docs/sms/quickstart/node).

It _also_ expects to be run in some kind of host that handles SSL termination on its behalf and so uses HTTP. (We've used Heroku for this, and a working [Procfile](Procfile) is included in this repository.)

To run `sms-location-bot`, first get yourself a Twilio number that can receive and send SMS. Then, execute `node index.js` in some kind of container that is capable of terminating SSL and setting `PORT`, `MILE_RADIUS` and `DATA_URL` in the process environment (Heroku dyno, DO droplet, AWS Elastic Beanstalk, etc.) and point a stable DNS name at the running instance location.

Next, provide that DNS name plus `/sms` to your Twilio number's webhook for incoming messages:

![Twilio Console showing webhook configuration](./twilio_webhook.png "Example of Twilio webhook console page")

Texts to your Twilio number will now process the incoming message for inputs (e.g., ZIP codes), look up relevant data in the `DATA_URL` file, and compile a response.

## A brief tour of the repo

This repo is componentized in an attempt to isolate functionality specific to certain formats, contexts or external services. The repo's codebase includes:

```{text}
/
|-index.js - the starting point for running the app
|-lib/ - folder containing componentized code
| |-server.js - the server-related code, called from index.js
| |-data_updater.js - the class handling data updates from the external data source (DATA_URL)
| |-zipcode_extractor.js - the class handling munging of incoming messages to extract zip codes
| |-shelters_finder.js - the adapter class handling all aspects of dealing with shelter data
| |-twilio_formatter.js - the adapter class handling outgoing message formatting
|-test/ - folder containing all tests
  |-fixures/ - folder containing test fixtures
  |-... test files for each component
```

### A note on the use of `esm`

Because the [`geodesy` library](https://www.npmjs.com/package/geodesy) uses ECMAScript Module syntax (`import`/`export` instead of `require(...)`/`module.exports=`), we had to upgrade the app to do so too. We use this library to compute distances between the input zip codes and the known locations.

In node.js LTS 8.x and 10.x, that syntax is [only available behind the `--experimental-modules` flag](https://medium.com/@nodejs/announcing-a-new-experimental-modules-1be8d2d6c2ff) of the node runtime.

As an alternative, the [`esm` npm package](https://www.npmjs.com/package/esm) auto-translates that module syntax on the fly. That package is included as a runtime dependency in our `package.json`, so that it's installed when you `npm install` the app.

You'll note that in the instructions above, as well as in the `scripts` section of the `package.json` and the `Procfile`, we've included the `-r esm` flag on the `node` and `mocha`. This tells `node` to require the `esm` package on start, before loading the app's code.

## Configuring `sms-location-bot`

### Environment variables

Here is a list of the configuration parameters `sms-location-bot` expects to find in its process environment:

- `PORT`: the HTTP port for the Express server to listen on
- `DATA_URL`: the location of the `geo.json`-style location file
- `MILE_RADIUS`: the radius in miles to use for inclusion of a location in the result set sent via SMS to the user (default: 30)

### Data format

`sms-location-bot` expects to find at `DATA_URL` a GeoJSON file describing the resources it is helping callers to locate. For more on the GeoJSON standard, see [geojson.org](https://geojson.org/).

The first use of `sms-location-bot` for the Hurricane Barry response in 2019 leveraged an existing `geo.json` file with
a shape like:

```json
{"type":"FeatureCollection",
    "features":[
        {"type":"Feature",
            "geometry":{"type":"Point","coordinates":[xx.nnnn,yy.nnnn]},
            "properties":{"accepting":"yes",
                "shelter":"Shelter Name","address":"Full mailing address","city":"CITY_NAME","state":"ST","county":"County Name","zip":"99999","phone":null,"updated_by":null,"notes":null,"volunteer_needs":null,"longitude":-99.7487,"latitude":40.7868,"supply_needs":null,"source":"Source org id","google_place_id":null,"special_needs":null,"id":2,"archived":false,"pets":"No","pets_notes":null,"needs":[],"updated_at":"2019-07-11T13:52:43-05:00","updatedAt":"2019-07-11T13:52:43-05:00","last_updated":"2019-07-11T13:52:43-05:00","cleanPhone":"badphone"}},
            ...
    ]
}
```

The `extractGeoJsonData` function in `lib/data_updater.js` expects the standard GeoJSON format implicitly, as well as a `zip` property as part of the `properties` object of each feature in the `features` array.

Working with other data formats, even ones that depend on some other key than ZIP code like area code, date, etc. would need to alter `extractGeoJsonData` to suit.

In addition, the `SheltersFinder` class in `lib/shelters_finder.js` expects and makes use of several other property names within the `properties` object of each feature. Excluding the use of zip code for location query, this class can be considered an adapter to the data, containing all location-specific content. For different data, you can replace this class with something else, and call its primary finder interface (`findShelters(...)` in `SheltersFinder`) from `lib/server.js`. (This hasn't been tried, so please post an issue here if you find this is not true!)

## Tests

Tests cover a majority of functionality of the classes in lib, but do not yet cover end-to-end testing of the API server portion of the code.

PRs are welcome to enhance our test coverage!

## Docs

We try to keep the docs up-to-date with the codebase. To that end, we've used JSdoc in the code for function- and class-level documentation. This file is also kept up-to-date.

If you notice something missing, or an inaccuracy, in the documentation, please submit a PR to fix it. We appreciate your help!
