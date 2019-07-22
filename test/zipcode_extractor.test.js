import ZipcodeExtractor from '../lib/zipcode_extractor';

import { expect } from 'chai';
import util from 'util';

describe('ZipcodeExtractor', () => {
  describe('constructor()', () => {
    it('creates a ZipcodeExtractor object', () => {
      const tf = new ZipcodeExtractor();
      expect(tf).to.be.instanceOf(ZipcodeExtractor);
    });
  });
  describe('extractMessageZipCodes(...)', () => {
    it('extracts one zipcode from a message with only a zipcode', () => {
      const ze = new ZipcodeExtractor();
      const message = '70118';
      expect(ze.extractMessageZipCodes(message)).to.deep.eql(['70118']);
    });
    it('extracts a zipcode from among other text', () => {
      const ze = new ZipcodeExtractor();
      const message = 'something 70118 more';
      expect(ze.extractMessageZipCodes(message)).to.deep.eql(['70118']);
    });
    it('does not extract an invalid zipcode', () => {
      const ze = new ZipcodeExtractor();
      const message = 'something 00000 more';
      expect(ze.extractMessageZipCodes(message)).to.deep.eql([]);
    });
    it('extracts several zipcodes from among other text', () => {
      const ze = new ZipcodeExtractor();
      const message = 'something 70118, 70124 and 70471 more';
      const extracted = ze.extractMessageZipCodes(message);
      for (let zip of ['70118', '70124', '70471']) {
        expect(extracted).to.include(zip);
      }
    });
  });
});
