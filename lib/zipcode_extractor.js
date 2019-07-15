import zipcodes from 'zipcodes';

/**
 * Class to extract zipcodes from message strings
 */
export default class ZipcodeExtractor {
  /**
   * Constructor
   * @returns {ZipcodeExtractor} - the created ZipcodeExtractor instance
   */
  constructor () { }
  
  /**
   * Extracts zipcode strings from the message string
   * @param {string} message - the message string to extract from
   * @returns {Array<string>} - the resulting array of zipcode strings
   */
  extractMessageZipCodes (message) {
    const zipCodeRegex = RegExp('[0-9]{5}', 'g');
    let matches = [];
    let match;
    while ((match = zipCodeRegex.exec(message)) != null) {
      matches.push(match[0]);
    }
    // ensure valid US/Canada zip codes found
    return matches.filter((z) => zipcodes.lookup(z).hasOwnProperty('zip'));
  }
}
