import SheltersFinder from '../lib/shelters_finder';
import DataUpdater from '../lib/data_updater';
import LatLon from 'geodesy/latlon-ellipsoidal-vincenty';

import { expect } from 'chai';
import fs from 'fs';

// Fixtures
const dataFixture = JSON.parse(
  fs.readFileSync(`${__dirname}/fixtures/geo.json`).toString()
);

describe('SheltersFinder', () => {
  describe('constructor', () => {
    it('creates a SheltersFinder object', () => {
      const s = new SheltersFinder(new Map(), 100, 20);
      expect(s).to.be.instanceOf(SheltersFinder);
    });
  });

  describe('updateLocationData', () => {
    it('updates the data with the provided object', () => {
      const startData = { 'some': 'data' };
      const updateData = { 'other': 'data' };
      const s = new SheltersFinder(startData, 100, 5);
      expect(s.locationData).to.deep.eql(startData);
      s.updateLocationData(updateData);
      expect(s.locationData).to.deep.eql(updateData);
    });
  });

  describe('findClosestNShelters', () => {
    it('returns n closest shelters to given point and no more', () => {
      const d = new DataUpdater('some url');
      const locationData = d.extractGeoJsonData(dataFixture.features);
      const s = new SheltersFinder(locationData, 100, 2);
      const my_point = new LatLon(-99, 40);
      const expected_names = Array(
        "Pancho Maples FEMA Community Safe Room",
        "Mercedes Saferoom/Community Recreation",
      );
      const result = s.findClosestNShelters(my_point, 2);
//      console.log(`### Result = ${JSON.stringify(result)}`)
      expect(result.map(s => s['shelter'])).to.deep.eql(expected_names);
    });
   });

 describe('getShelterDistances', () => {
  it('adds distance to current point for all shelters', () => {
      const d = new DataUpdater('some url');
      const locationData = d.extractGeoJsonData(dataFixture.features);
      const s = new SheltersFinder(locationData, 100, 5);
      const my_point = new LatLon(-99, 40);
      const expected_distances = Array(
        15253092.814,
        15243189.907,
        14865529.136,
        14865578.005,
        13623054.565,
        13620703.433,
        13633121.898,
        14116333.954,
      );
      const result = s.getShelterDistances(my_point);
      expect(result.map(s => s['distance'])).to.deep.eql(expected_distances);
  })
 });

  describe('findShelters', () => {
    it('locates shelters within n miles of passed LatLon', () => {
        const d = new DataUpdater('some url');
        const locationData = d.extractGeoJsonData(dataFixture.features);
        const s = new SheltersFinder(locationData, 100, 2);
        const expected_messages = Array(
          "Found 2 shelters near your location:\nWillacy County Community Safe Room\n18508 US-77 Frontage Rd, Harlingen, TX 78552, USA\nAbout 15mi away\nPancho Maples FEMA Community Safe Room\n621 Pancho Maples Dr, La Feria, TX 78559, USA\nAbout 23mi away",
        );
        const input_lat_lon = new LatLon(26.4792, -97.7967)
        const result = s.findShelters(input_lat_lon);
        expect(result).to.deep.eql(expected_messages);
    })
    it('truncates list of nearby shelters by distance', () => {
        const d = new DataUpdater('some url');
        const locationData = d.extractGeoJsonData(dataFixture.features);
        const s = new SheltersFinder(locationData, 20, 6);
        const expected_messages = Array(
          "Found 1 shelters near your location:\nWillacy County Community Safe Room\n18508 US-77 Frontage Rd, Harlingen, TX 78552, USA\nAbout 15mi away"
        );
        const input_lat_lon = new LatLon(26.4792, -97.7967)
        const result = s.findShelters(input_lat_lon);
        expect(result).to.deep.eql(expected_messages);
    })
  });
});
