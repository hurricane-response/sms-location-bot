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
  constructor (locationData, mileRadius, nSheltersToFind) {
    this.locationData = locationData;
    this.mileRadius = mileRadius;
    this.nSheltersToFind = nSheltersToFind;
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
    var messages = [];
    for (const zipCode of sentZipCodes) {
      console.log(`Checking zip: ${zipCode}`)
      let zipInfoToTest = zipcodes.lookup(zipCode);
      let zipLatLon = new LatLon(zipInfoToTest.latitude, zipInfoToTest.longitude);
      let closest_shelters = this.findClosestNShelters(zipLatLon, this.nSheltersToFind);
      let filtered_shelters = closest_shelters.filter(
        shelter => this.convertMetersToMiles(shelter.distance) <= this.mileRadius
      );
      messages = messages.concat(this.buildReplyFromShelterList(filtered_shelters, zipCode));
    }
    return messages;
  }

  /**
   * Get shelters by distance to currentPoint
   * @param {LatLon} currentPoint - the point to find shelters nearest to
   * @param {number} maxShelters - maximum number of shelters to return
   * @returns {Array<Object>} - the array of shelters
  */
  findClosestNShelters (currentPoint, maxShelters) {
    let shelters_with_distances = this.getShelterDistances(currentPoint);
    let sorted_shelters = shelters_with_distances.sort(function(a, b) {
      return a.distance - b.distance;
    })
    return this.truncateShelterList(sorted_shelters, maxShelters);
  }

  /**
   * Compute distance from currentPoint to each shelter
   * @param {LatLon} currentPoint - the point to find shelters nearest to
   * @returns {Array<Object>} - the array of shelters with distance added
  */
  getShelterDistances (currentPoint) {
    let all_shelters = this.getAllShelters();
    return all_shelters.map((shelter) => {
      return this.addDistanceToCurrentPoint(currentPoint, shelter);
    });
  }

  /**
   * Get all shelters available
   * @returns {Array<Object>} - an array of all shelters
  */
  getAllShelters () {
    let all_shelters = [];
    this.locationData.forEach((shelter_list) => {
      all_shelters = all_shelters.concat(Array.from(shelter_list));
    });
    return all_shelters;
  }

  /**
   * Compute distance from currentPoint to given shelter
   * @param {LatLon} currentPoint - location on globe to compute distance to
   * @param {Object} shelter - shelter to compute distance to
   * @returns {Object} - the shelter object with distance attribute added
  */
  addDistanceToCurrentPoint (currentPoint, shelter) {
    const shelterLatLon = new LatLon(shelter.latitude, shelter.longitude);
    shelter['distance'] = shelterLatLon.distanceTo(currentPoint);
    return shelter;
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
   * Collect the shelters for the array of zip codes into an Array
   * @param {Array<Object>} shelters - the shelters to be returned to user
   * @param {string} zipcode - zipcode
   * @returns {Array<string>} - the array of messages
   */
  buildReplyFromShelterList (shelters, zipcode) {
    if (shelters.length == 0) {
      return [`Sorry, I don't know about any shelters near ${zipcode}. Please try again later!`,];
    }
    const messages = [];
    let resultString = `Found ${shelters.length} shelters near your location:`;
    for (let shelter of shelters) {
      const msg = this.constructMessageFromShelter(shelter);
      if ((resultString + msg).length > 800) {
        messages.push(resultString);
        resultString = '';
      }
      resultString += msg;
    }
    if (resultString.length > 0) {
      messages.push(resultString)
    }
    return messages;
  }

  /**
   * Create distance message for a given shelter
   * @param {Object} shelter - a shelter with distance to describe
   * @returns {string} - Message for this shelter
   */
  constructMessageFromShelter (shelter) {
    let dist = this.convertMetersToMiles(shelter['distance']);
    return this.getStringRepresentationForShelter(shelter) +
      `\n${dist < 1 ? 'Under 1' : `About ${dist}`}mi away`;
  }

  /**
   * Convert from meters to miles
   * @param {number} meters - a number in meters
   * @returns {number} - that number in miles
   */
  convertMetersToMiles (meters) {
    const milesToMeters = 1609.344, metersToMiles = 1.0 / milesToMeters;
    let dist = metersToMiles * meters;
    return (dist < 1.0 ? Math.ceil(dist * 10) / 10 : Math.ceil(dist));
  }

  /**
   * Create string representation of a shelter
   * @param {Object} shelterObj - The data for a shelter
   * @returns {string} - A string representing relevant information to describe the shelter
   */
  getStringRepresentationForShelter (shelterObj) {
     const { shelter, address, phone } = shelterObj;
     return `\n${shelter}\n${address}${phone ? `\n${phone}` : ''}`;
  }
}
