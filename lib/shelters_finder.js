import zipcodes from 'zipcodes';
import LatLon from 'geodesy/latlon-ellipsoidal-vincenty';

/**
 * Class that finds shelters for a given set of zipcodes
 */
export default class SheltersFinder {
  /**
   * Constructor for class
   * @param {Map<string,Array<Object>>} locationData - the shelter location geodata
   * @param {number} mileRadius - the mile radius to use when finding nearby shelters
   * @returns {SheltersFinder} - the created SheltersFinder instance
   */
  constructor (locationData, mileRadius) {
    this.locationData = locationData;
    this.mileRadius = mileRadius;
  }

  /**
   * Update shelter location geodata used in lookups
   * @param {Map<string,Array<Object>>} locationData - the new shelter location geodata
   * @returns {void}
   */
  updateLocationData (locationData) { this.locationData = locationData; }

  /**
   * Process an incoming message to extract zipcode information
   * @param {Array<string>} sentZipCodes - the zipcodes to find shelters for
   * @returns {Array<string>} - the array of shelter messages
   */
  findShelters (sentZipCodes) {
    if(sentZipCodes.length == 0) {
      return ['Sorry, I couldn\'t find any ZIP codes in your text message. Please try again.',];
    }
    const knownZipCodes = this.zipCodesWithShelters();
    const lookupZipCodes = this.augmentLookupZipCodes(sentZipCodes);
    let foundShelters = this.computeFoundShelters(lookupZipCodes, knownZipCodes);
    if (foundShelters.length == 0) {
      return [`Sorry, I don't know about any shelters near ${sentZipCodes.join(' or ')}. Please try again later!`,];
    }
    let sheltersArray = this.collectShelters(foundShelters, lookupZipCodes);
    sheltersArray = _dedupeArray(sheltersArray, 'shelterIndex');

    const sorts = this.sortedShelterListsByLookupZip(sheltersArray, lookupZipCodes.map((z) => z.zip), 3);
    const messages = this.buildMessages(sorts);
    return messages;
  }

  /**
   * Get all zip codes with known shelters in them
   * @returns {Array<string>} - the array of zip codes
   */
  zipCodesWithShelters () {
    return Array.from(this.locationData.keys());
  }
  
  /**
   * Augment the zipcodes with zip information and zips in radius
   * @param {Array<string>} zips - the array of zipcodes to augment
   * @returns {Array<Object>} - the array of augmented zipcodes
   */
  augmentLookupZipCodes (zips) {
    return zips.map((zip) => {
      const zipInfo = zipcodes.lookup(zip);
      return {
        zip: zipInfo.zip,
        info: zipInfo,
        latlon: new LatLon(zipInfo.latitude, zipInfo.longitude),
        zipsInMileRadius: zipcodes.radius(zipInfo.zip, this.mileRadius)
      };
    });
  }

  /**
   * Compute the shelters found in the known zip codes from the lookups
   * @param {Array<Object>} lookupZipCodes - the zipcodes to perform the lookup with
   * @param {Array<Object>} knownZipCodes - the known zipcodes among the shelters
   * @returns {Array<Object>} - the array of shelters found from the lookup
   */
  computeFoundShelters (lookupZipCodes, knownZipCodes) {
    let foundShelters = [];
    lookupZipCodes.forEach((z) => {
      knownZipCodes.forEach((known) => {
        if (z.zipsInMileRadius.indexOf(known.toString()) >= 0) {
          foundShelters.push(known.toString());
        }
      });
    });
    return foundShelters;
  }

  /**
   * Augment the shelter record with distance from lookups, whether its
   * in the radius from the lookups, and with the message segment
   * @param {Object} shelterRecord - the shelter record object
   * @param {Array<Object>} lookupZipCodes - the array of lookups
   * @returns {Array<Object>} - the augmented shelter record
   */
  augmentShelterRecord (shelterRecord, lookupZipCodes) {
    const { shelter, address, phone } = shelterRecord;
    const shelterLatLon = new LatLon(shelterRecord.latitude, shelterRecord.longitude);
    const shelterDistancesFromLookupZips = Array.from(
      lookupZipCodes.map((zip) => {
        return zip.latlon.distanceTo(shelterLatLon);
      })
    );
    const zipInMileRadiusFromShelter = Array.from(
      lookupZipCodes.map((zip) => {
        return zip.zipsInMileRadius.includes(shelterRecord.zip);
      })
    );
    const distances = {};
    const inRadius = {};
    for (let idx in lookupZipCodes) {
      const zip = lookupZipCodes[idx].zip;
      distances[zip] = shelterDistancesFromLookupZips[idx]; 
      inRadius[zip] = zipInMileRadiusFromShelter[idx];
    }
    return {
      ...shelterRecord,
      distances: distances,
      inRadius: inRadius,
      message: `\n\n${shelter}\n${address}${phone ? `\n${phone}` : ''}`
    };
  }

  /**
   * Collect the shelters for the array of zip codes into an Array
   * @param {Array<Object>} foundShelters - the shelters to be collected
   * @param {Array<Object>} lookupZipCodes - the augmented lookup zips
   * @returns {Array<Object>} - the collected arrray of all relevant shelters
   */
  collectShelters (foundShelters, lookupZipCodes) {
    let sheltersArray = [];
    for (let zip of foundShelters) {
      const loc = this.locationData.get(zip);
      if (loc) {
        const shelters = Array.from(loc);
        sheltersArray = sheltersArray.concat(
          shelters.map(
            (shelterRecord) => {
              return this.augmentShelterRecord(shelterRecord, lookupZipCodes)
            }
          )
        );
      } else {
        console.warn(`Unexpected missing zip: ${zip}`);
      }
    }
    return sheltersArray;
  }

  /**
   * Return the array of shelters in radius, filtering out those not
   * @param {Array<Object>} shelters - the array of shelters
   * @param {string} lookupZip - the lookup index for the radius value
   * @returns {Array<Object>} - the filtered array of shelters
   */
  getInRadiusShelters (shelters, lookupZip) {
    return shelters.filter((sh, _i, _a, k = lookupZip) => sh.inRadius[k]);
  }

  /**
   * Return the array of shelters sorted by distance ascending
   * @param {Array<Object>} shelters - the array of shelters
   * @param {string} lookupZip - the lookup zipcode for the distance value
   * @returns {Array<Object>} - the sorted array of shelters
   */
  sortSheltersByDistance (shelters, lookupZip) {
    return shelters.sort((a, b, k = lookupZip) =>
      a.distances[k] - b.distances[k]
    );
  }

  /**
   * Truncate the array of shelters to the amount specified
   * @param {Array<Object>} shelters - the array of shelters
   * @param {number} amount - the number of shelters to return
   * @returns {Array<Object>} - the truncated array of shelters
   */
  truncateShelterList (shelters, amount) {
    return shelters.slice(0, amount);
  }

  /**
   * Filter, sort and truncate the list of shelters per lookup zipcode
   * @param {Array<Object>} shelters - the array of augmented shelter records
   * @param {Array<Object>} lookups - the array of augmented lookup zipcodes
   * @param {number} sheltersPerLookup - the number of shelters to return per lookup zipcode
   * @returns {Array<Object>} - the filtered, sorted and truncated array
   */
  sortedShelterListsByLookupZip (shelters, lookups, sheltersPerLookup) {
    const results = {};
    const n = sheltersPerLookup;
    lookups.forEach((zip) => {
      const filtered = this.getInRadiusShelters(shelters, zip);
      const sorted = this.sortSheltersByDistance(filtered, zip);
      const truncated = this.truncateShelterList(sorted, n);
      results[zip] = truncated;
    });
    return results;
  }

  /**
   * Construct messages from sorted shelter lists by lookup zipcode
   * @param {Object} sorts - the object of sorted shelter lists keyed by lookup zipcode
   * @returns {Array<string>} - the array of messages
   */
  buildMessages (sorts) {
    const messages = [];
    const milesToMeters = 1609.344, metersToMiles = 1.0 / milesToMeters;
    for (let key in sorts) {
      const sheltersSort = sorts[key];
      const zipcode = key;
      let resultString = `Found ${sheltersSort.length} shelters near ${zipcode}:`;
      for (let shelter of sheltersSort) {
        let dist = metersToMiles * shelter.distances[key];
        dist = (dist < 1.0 ? Math.ceil(dist * 10) / 10 : Math.ceil(dist));
        const msg = shelter.message +
          `\n${dist < 1 ? 'Under 1' : `About ${dist}`}mi away`;
        if ((resultString + msg).length > 800) {
          messages.push(resultString);
          resultString = '';
        }
        resultString += msg;
      }
      if (resultString.length > 0) { messages.push(resultString) }
    }
    return messages;
  }
}

// Helper functions
export const _dedupeArray = function (arr, key) {
  let a = _deepCopyArray(arr).reverse();
  a = a.filter(function (e, i, a) {
    const testVal = e[key];
    return a.slice(i + 1).findIndex((o) => o[key] === testVal) === -1;
  });
  return a.reverse();
};

export const _deepCopyArray = function (o) {
  let output, v, key;
  output = Array.isArray(o) ? [] : (o == null ? null : {});
  for (key in o) {
    if (o.hasOwnProperty(key)) {
      v = o[key];
      output[key] = (typeof v === 'object') ? _deepCopyArray(v) : v;
    }
  }
  return output;
};