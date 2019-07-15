import TwilioFormatter from '../lib/twilio_formatter';

import { expect } from 'chai';
import util from 'util';

describe('TwilioFormatter', () => {
  it('creates a TwilioFormatter object', () => {
    const tf = new TwilioFormatter();
    expect(tf instanceof TwilioFormatter).to.be.true;
  });
  it('provides max message length', () => {
    util.inspect(TwilioFormatter);
    expect(TwilioFormatter).to.have.ownProperty('MAX_MESSAGE_SIZE');
    expect(TwilioFormatter.MAX_MESSAGE_SIZE).to.eql(1600);
  })
  it('validates message length when below max message length', () => {
    const tf = new TwilioFormatter();
    const messages = [''.padEnd(10, 'x')]
    expect(tf.validateMessages(messages)).to.deep.eql(messages);
  });
});
