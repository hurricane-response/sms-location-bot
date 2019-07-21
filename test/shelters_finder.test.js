import SheltersFinder, { _dedupeArray, _deepCopyArray } from '../lib/shelters_finder';
import DataUpdater from '../lib/data_updater';
import zipcodes from 'zipcodes';
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
      const s = new SheltersFinder(new Map(), 5);
      expect(s).to.be.instanceOf(SheltersFinder);
    });
  });

  describe('updateLocationData', () => {
    it('updates the data with the provided object', () => {
      const startData = { 'some': 'data' };
      const updateData = { 'other': 'data' };
      const s = new SheltersFinder(startData, 5);
      expect(s.locationData).to.deep.eql(startData);
      s.updateLocationData(updateData);
      expect(s.locationData).to.deep.eql(updateData);
    });
  });

  describe('zipCodesWithShelters()', () => {
    it('returns an array of zip codes', () => {
      const d = new DataUpdater('some url');
      const locationData = d.extractGeoJsonData(dataFixture.features);
      const s = new SheltersFinder(locationData, 5);
      const zips = s.zipCodesWithShelters();
      const expected = ['68850','68883','93555','78570','78559','78580','71301'];
      for (let zip of expected) { expect(zips).includes(zip); }
    });
  });
  
  describe('augmentLookupZipCodes(...)', () => {
    it('returns an array of objects with a zip property containing the zip code', () => {
      const s = new SheltersFinder(new Map(), 5);
      const zipcodes = ['70471', '70118'];
      const augmentedZips = s.augmentLookupZipCodes(zipcodes);
      for (let idx in augmentedZips) {
        expect(augmentedZips[idx]).to.have.ownProperty('zip');
        expect(augmentedZips[idx].zip).to.eql(zipcodes[idx]);
      }
    });
    it('returns an array of objects with an info property matching interface zipcodes.ZipCode', () => {
      const s = new SheltersFinder(new Map(), 5);
      const ZipCodeType = zipcodes.lookup('70003').constructor;
      const zips = ['70471', '70118'];
      const augmentedZips = s.augmentLookupZipCodes(zips);
      for (let idx in augmentedZips) {
        expect(augmentedZips[idx]).to.have.ownProperty('info');
        expect(augmentedZips[idx].info).to.be.instanceOf(ZipCodeType);
      }
    });
    it('returns an array of objects with an latlon property of type LatLon', () => {
      const s = new SheltersFinder(new Map(), 5);
      const zipcodes = ['70471', '70118'];
      const augmentedZips = s.augmentLookupZipCodes(zipcodes);
      for (let idx in augmentedZips) {
        expect(augmentedZips[idx]).to.have.ownProperty('latlon');
        expect(augmentedZips[idx].latlon).to.be.instanceOf(LatLon);
      }
    });
    it('returns an array of objects with an zipsInMileRadius property with an array of objects matching interface zipcodes.ZipCode', () => {
      const s = new SheltersFinder(new Map(), 5);
      const zips = ['70471', '70118'];
      const augmentedZips = s.augmentLookupZipCodes(zips);
      for (let idx in augmentedZips) {
        expect(augmentedZips[idx]).to.have.ownProperty('zipsInMileRadius');
        expect(augmentedZips[idx].zipsInMileRadius).to.be.an('array');
        augmentedZips[idx].zipsInMileRadius.forEach((z) => {
          expect(z).to.be.a('string');
        });
      }
    });
  });

  describe('computeFoundShelters(...)', () => {
    it('returns known zipcodes within the mile radius of each of the lookup zipcodes', () => {
      const s = new SheltersFinder(new Map(), 5);
      const lookups = ['70471', '70118'].map((z, _idx, _ary, sf = s) => {
        return {
          zipsInMileRadius: zipcodes.radius(z, sf.mileRadius)
        };
      });
      const knowns = ['70124', '70003', '70116', '70471'];
      const found = s.computeFoundShelters(lookups, knowns);
      const expected = ['70124', '70116', '70471'];
      for (let zip of expected) { expect(found).includes(zip); }
    });
  });

  describe('augmentShelterRecord(...)', () => {
    it('returns an object with property distances having keys lookups', () => {
      const s = new SheltersFinder(new Map(), 5);
      const shelter = dataFixture.features[0].properties;
      const lookups = s.augmentLookupZipCodes(['70471', '70118']);
      const augmented = s.augmentShelterRecord(shelter, lookups);
      expect(augmented).to.have.ownProperty('distances');
      expect(augmented.distances).to.be.an('object');
      for (let l of lookups) {
        expect(augmented.distances).to.have.ownProperty(l.zip);
      }
    });
    it('returns an object with property inRadius having keys lookups', () => {
      const s = new SheltersFinder(new Map(), 5);
      const shelter = dataFixture.features[0].properties;
      const lookups = s.augmentLookupZipCodes(['70471', '70118']);
      const augmented = s.augmentShelterRecord(shelter, lookups);
      expect(augmented).to.have.ownProperty('inRadius');
      expect(augmented.inRadius).to.be.an('object');
      for (let l of lookups) {
        expect(augmented.inRadius).to.have.ownProperty(l.zip);
      }
    });
    it('returns an object with array property message type string', () => {
      const s = new SheltersFinder(new Map(), 5);
      const shelter = dataFixture.features[0].properties;
      const lookups = s.augmentLookupZipCodes(['70471', '70118']);
      const augmented = s.augmentShelterRecord(shelter, lookups);
      expect(augmented).to.have.ownProperty('message');
      expect(augmented.message).to.be.a('string');
    });
  });

  describe('collectShelters(...)', () => {
    it('returns an array of objects ', () => {
      const d = new DataUpdater('some_url');
      const locationData = d.extractGeoJsonData(dataFixture.features);
      const s = new SheltersFinder(locationData, 5);
      const lookups = s.augmentLookupZipCodes(['68850', '71301']);
      const knowns = s.zipCodesWithShelters();
      const foundShelters = s.computeFoundShelters(lookups, knowns);
      const collected = s.collectShelters(foundShelters, lookups);
      const expected = Array.from(
        JSON.parse('[{"accepting":"yes","shelter":"Lexington High School","address":"1308 N Adams St, Lexington, NE 68850, USA","city":"LEXINGTON","state":"NE","county":"Dawson County","zip":"68850","phone":null,"updated_by":null,"notes":null,"volunteer_needs":null,"longitude":-99.7487,"latitude":40.7868,"supply_needs":null,"source":"FEMA GeoServer, Shelter ID: 223259, Org ID: 121390, FORT KEARNEY CHAPTER","google_place_id":null,"special_needs":null,"id":2,"archived":false,"pets":"No","pets_notes":null,"needs":[],"updated_at":"2019-07-11T13:52:43-05:00","updatedAt":"2019-07-11T13:52:43-05:00","last_updated":"2019-07-11T13:52:43-05:00","cleanPhone":"badphone","shelterIndex":1},{"accepting":"yes","shelter":"Bolton Ave. Community Center","address":"226 Bolton Ave, Alexandria, LA 71301, USA","city":"ALEXANDRIA","state":"LA","county":"Rapides Parish","zip":"71301","phone":null,"updated_by":null,"notes":null,"volunteer_needs":null,"longitude":-92.458,"latitude":31.3076,"supply_needs":null,"source":"FEMA GeoServer, Shelter ID: 328703, Org ID: 121263, Central Louisiana Chapter","google_place_id":null,"special_needs":null,"id":8,"archived":false,"pets":"No","pets_notes":null,"needs":[],"updated_at":"2019-07-11T19:42:07-05:00","updatedAt":"2019-07-11T19:42:07-05:00","last_updated":"2019-07-11T19:42:07-05:00","cleanPhone":"badphone","shelterIndex":8}]')
          .map(
            (sh, _i, _a, sf = s, l = lookups) =>
              sf.augmentShelterRecord(sh, l)
          )
      );
      expect(collected).to.be.an('array');
      for (let shelter of expected) {
        expect(collected).to.deep.include(shelter);
      }
    });
  });

  describe('getInRadiusShelters(...)', () => {
    it('returns in-radius shelters for the lookup as an array', () => {
      const s = new SheltersFinder(new Map(), 5);
      const shelters = [
        { inRadius: { '70471': true, '70118': false } },
        { inRadius: { '70471': true, '70118': true } },
        { inRadius: { '70471': false, '70118': false } },
        { inRadius: { '70471': false, '70118': true } }
      ];
      const expected_70471 = [
        { inRadius: { '70471': true, '70118': false } },
        { inRadius: { '70471': true, '70118': true } }
      ];
      for (let sh of expected_70471) {
        expect(s.getInRadiusShelters(shelters, '70471')).to.deep.include(sh);
      }
      const expected_70118 = [
        { inRadius: { '70471': true, '70118': true } },
        { inRadius: { '70471': false, '70118': true } }
      ];
      for (let sh of expected_70118) {
        expect(s.getInRadiusShelters(shelters, '70118')).to.deep.include(sh);
      }
    });
  });

  describe('sortSheltersByDistance(...)', () => {
    it('sorts by ascending distance from the given lookup', () => {
      const s = new SheltersFinder(new Map(), 5);
      const shelters = [
        { distances: { '70471': 5.6, '70118': 4.3, '70124': 2.1 } },
        { distances: { '70471': 1.2, '70118': 2.8, '70124': 2.9 } },
        { distances: { '70471': 3.3, '70118': 1.0, '70124': 9.6 } }
      ];
      const expected_70471 = [
        { distances: { '70471': 1.2, '70118': 2.8, '70124': 2.9 } },
        { distances: { '70471': 3.3, '70118': 1.0, '70124': 9.6 } },
        { distances: { '70471': 5.6, '70118': 4.3, '70124': 2.1 } }
      ];
      for (let sh of expected_70471) {
        expect(s.sortSheltersByDistance(shelters, '70471')).to.deep.include(sh);
      }
      const expected_70118 = [
        { distances: { '70471': 3.3, '70118': 1.0, '70124': 9.6 } },
        { distances: { '70471': 1.2, '70118': 2.8, '70124': 2.9 } },
        { distances: { '70471': 5.6, '70118': 4.3, '70124': 2.1 } }
      ];
      for (let sh of expected_70118) {
        expect(s.sortSheltersByDistance(shelters, '70118'))
          .to.deep.include(sh);
      }
      const expected_70124 = [
        { distances: { '70471': 5.6, '70118': 4.3, '70124': 2.1 } },
        { distances: { '70471': 1.2, '70118': 2.8, '70124': 2.9 } },
        { distances: { '70471': 3.3, '70118': 1.0, '70124': 9.6 } }
      ];
      for (let sh of expected_70124) {
        expect(s.sortSheltersByDistance(shelters, '70124')).to.deep.include(sh);
      }
    });
  });

  describe('truncateShelterList(...)', () => {
    it('truncates the array of shelters to the specified length', () => {
      const s = new SheltersFinder(new Map(), 5);
      const shelters = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      let amt, x;
      for (amt of [2, 3, 7, 12]) {
        const truncated = s.truncateShelterList(shelters, amt);
        const expected = Math.min(amt, shelters.length);
        expect(truncated).to.be.an('array');
        expect(truncated.length).to.eql(expected);
        for (x = 0; x < expected; x++) {
          expect(truncated[x]).to.eql(shelters[x]);
        }
      }
    });
  });

  describe('sortedShelterListsByLookupZip', () => {
    it('returns filtered, sorted and truncated lists of shelters for each lookup zipcode', () => {
      const s = new SheltersFinder(new Map(), 5);
      const shelters = [
        {
          distances: { '70471': 5.6, '70118': 4.3, '70124': 2.1 },
          inRadius: { '70471': false, '70118': true, '70124': true }
        },
        {
          distances: { '70471': 1.2, '70118': 2.8, '70124': 2.9 },
          inRadius:  { '70471': true, '70118': true, '70124': true }
        },
        {
          distances: { '70471': 3.3, '70118': 1.0, '70124': 9.6 },
          inRadius:  { '70471': true, '70118': true, '70124': false }
        },
        {
          distances: { '70471': 5.3, '70118': 7.0, '70124': 8.1 },
          inRadius:  { '70471': false, '70118': false, '70124': false }
        }
      ];
      const lookups = [
        { zip: '70471' },
        { zip: '70118' },
        { zip: '70124' }
      ];
      const expected = {
        '70471': [
          {
            distances: { '70471': 1.2, '70118': 2.8, '70124': 2.9 },
            inRadius: { '70471': true, '70118': true, '70124': true }
          },
          {
            distances: { '70471': 3.3, '70118': 1.0, '70124': 9.6 },
            inRadius: { '70471': true, '70118': true, '70124': false }
          }
        ],
        '70118': [
          {
            distances: { '70471': 3.3, '70118': 1.0, '70124': 9.6 },
            inRadius: { '70471': true, '70118': true, '70124': false }
          },
          {
            distances: { '70471': 1.2, '70118': 2.8, '70124': 2.9 },
            inRadius: { '70471': true, '70118': true, '70124': true }
          }
        ],
        '70124': [
          {
            distances: { '70471': 5.6, '70118': 4.3, '70124': 2.1 },
            inRadius: { '70471': false, '70118': true, '70124': true }
          },
          {
            distances: { '70471': 1.2, '70118': 2.8, '70124': 2.9 },
            inRadius: { '70471': true, '70118': true, '70124': true }
          }
        ]
      };
      const lists = s.sortSheltersByDistance(shelters, lookups, 2);
      for (let lookup of lookups) {
        expect(lists[lookup]).to.deep.eql(expected[lookup]);
      }
    });
  });

  describe('buildMessages(...)', () => {
    it('generates an array of messages', () => {
      const s = new SheltersFinder(new Map(), 5);
      const sorts = {
        '70471': [
          {
            distances: { '70471': 418.4, '70118': 4506.2, '70124': 4667.1 },
            message: '\n\nSHELTER NUMBER ONE\n123 Any Street, Mandeville, LA 70471'
          },
          {
            distances: { '70471': 5310.8, '70118': 1609.3, '70124': 15449.7 },
            message: '\n\nSHELTER NUMBER TWO\n123 Any Street, New Orleans, LA 70118'
          }
        ],
        '70118': [
          {
            distances: { '70471': 5310.8, '70118': 1609.3, '70124': 15449.7 },
            message: '\n\nSHELTER NUMBER TWO\n123 Any Street, New Orleans, LA 70118'
          },
          {
            distances: { '70471': 418.4, '70118': 4506.2, '70124': 4667.1 },
            message: '\n\nSHELTER NUMBER ONE\n123 Any Street, Mandeville, LA 70471'
          }
        ],
        '70124': [
          {
            distances: { '70471': 9012.3, '70118': 6920.2, '70124': 3379.6 },
            message: '\n\nSHELTER NUMBER THREE\n456 Other Street, New Orleans, LA 70123'
          },
          {
            distances: { '70471': 418.4, '70118': 4506.2, '70124': 4667.1 },
            message: '\n\nSHELTER NUMBER ONE\n123 Any Street, Mandeville, LA 70471'
          }
        ]
      };
      const expected = [
        'Found 2 shelters near 70471:\n\nSHELTER NUMBER ONE\n123 Any Street, Mandeville, LA 70471\nUnder 1mi away\n\nSHELTER NUMBER TWO\n123 Any Street, New Orleans, LA 70118\nAbout 4mi away',
        'Found 2 shelters near 70118:\n\nSHELTER NUMBER TWO\n123 Any Street, New Orleans, LA 70118\nAbout 1mi away\n\nSHELTER NUMBER ONE\n123 Any Street, Mandeville, LA 70471\nAbout 3mi away',
        'Found 2 shelters near 70124:\n\nSHELTER NUMBER THREE\n456 Other Street, New Orleans, LA 70123\nAbout 3mi away\n\nSHELTER NUMBER ONE\n123 Any Street, Mandeville, LA 70471\nAbout 3mi away'
      ];
      for (let message of expected) {
        expect(s.buildMessages(sorts)).to.deep.include(message);
      }
    });
  });

  describe('helpers', () => {
    describe('_dedupeArray(...)', () => {
      it('dedupes an array of objects by key', () => {
        const arr = [
          { a: 0, b: 1, c: 2 },
          { a: 0, b: 3, c: 2 },
          { a: 0, b: 1, c: 8 },
          { a: 1, b: 1, c: 8 }
        ];
        const expected = {
          a: [
            { a: 0, b: 1, c: 2 },
            { a: 1, b: 1, c: 8 }
          ],
          b: [
            { a: 0, b: 1, c: 2 },
            { a: 0, b: 3, c: 2 },
          ],
          c: [
            { a: 0, b: 1, c: 2 },
            { a: 0, b: 1, c: 8 }
          ]
        };
        for (let key in expected) {
          expect(_dedupeArray(arr, key)).to.deep.equal(expected[key]);
        }
      });
    });

    describe('_deepCopyArray(...)', () => {
      it('deep-copies an array of arbitrary data types', () => {
        const arr = [0, 'string', false, ['another', 'array', 5], {
          some: 'object', of: 'structured', data: [9, 3, 2, 4, 1]
        }, 5, [ { a: 0, b: 1, c: 2 }, { a: 0, b: 1, c: 8 } ]];
        expect(_deepCopyArray(arr)).to.deep.equal(arr);
      });
    });
  });
});
