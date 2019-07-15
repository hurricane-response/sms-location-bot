import zipcodes from 'zipcodes';
import LatLon from 'geodesy/latlon-ellipsoidal-vincenty';

import util from 'util';

/**
 * Class that finds shelters for a given set of zipcodes
 */
export default class SheltersFinder {
  /**
   * Constructor for class
   * @param {Map<string,Array<Object>>} locationData - the shelter location geodata
   * @returns {SheltersFinder} - the created SheltersFinder instance
   */
  constructor (locationData) {
    this.locationData = locationData;
  }

  /**
   * Process an incoming message to extract zipcode information
   * @param {Array<string>} sentZipCodes - the zipcodes to find shelters for
   * @returns {Array<string>} - the array of shelter messages
   */
  findShelters (sentZipCodes) {
    if(sentZipCodes.length == 0) {
      return 'Sorry, I couldn\'t find any ZIP codes in your text message. Please try again.';
    }
    
    const knownZipCodes = Array.from(this.locationData.keys());
    let foundShelters = [];
    const lookupZipCodes = sentZipCodes.map((zip) => {
      const zipInfo = zipcodes.lookup(zip);
      return {
        zip: zip,
        info: zipInfo,
        latlon: new LatLon(zipInfo.latitude, zipInfo.longitude)
      };
    });
    knownZipCodes.map((known) => {
      lookupZipCodes.map((z) => {
        if(z.zip.startsWith(known.substring(0,2))) {
          foundShelters.push(known);
        }
      });
    });

    if (foundShelters.length == 0) {
      return `Sorry, I don't know about any shelters near ${sentZipCodes[0]}. Please try again later!`;
    }
    let sheltersArray = [];
    for (let zip of foundShelters) {
      const shelters = Array.from(this.locationData.get(zip));
      sheltersArray = sheltersArray.concat(
        shelters.map((sh) => {
          const { shelter, address, phone } = sh;
          return {
            ...sh,
            distances: Array.from(lookupZipCodes.map((zip) => {
              const shelterLatLon = new LatLon(sh.latitude, sh.longitude);
              return zip.latlon.distanceTo(shelterLatLon);
            })),
            message:`\n\n${shelter}\n${address}${phone?`\n${phone}`:''}`
          };
        })
      );
    }
    console.log(util.inspect(sheltersArray));
    sheltersArray = _dedupeArray(sheltersArray, 'shelterIndex');
    console.log(util.inspect(sheltersArray));
    const sorts = lookupZipCodes.map((_z, idx) => {
      return sheltersArray.sort(
        (a, b, k = idx) => a.distances[k] - b.distances[k]
      ).slice(0, 5);
    });
    console.log(util.inspect(sorts));
    let messages = [];
    for (let idx in sorts) {
      const sheltersSort = sorts[idx];
      const zipcode = lookupZipCodes[idx];
      let resultString = `Found ${sheltersSort.length} shelters near ${zipcode.zip}:`;
      for (let shelter of sheltersSort) {
        if ((resultString + shelter.message).length > 800) {
          messages.push(resultString);
          resultString = '';
        }
        resultString += shelter.message;
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