import TwilioFormatter from '../lib/twilio_formatter';

import MessagingResponse from 'twilio/lib/twiml/MessagingResponse';

import { expect } from 'chai';
import util from 'util';

describe('TwilioFormatter', () => {
  describe('class', () => {
    it('provides max message length', () => {
      expect(TwilioFormatter).to.have.ownProperty('MAX_MESSAGE_SIZE');
      expect(TwilioFormatter.MAX_MESSAGE_SIZE).to.eql(1600);
    });
  });
  describe('constructor()', () => {
    it('creates a TwilioFormatter object', () => {
      const tf = new TwilioFormatter();
      expect(tf instanceof TwilioFormatter).to.be.true;
    });
  });
  describe('validateMessages(...)', () => {
    it('validates message length when below max message length', () => {
      const tf = new TwilioFormatter();
      const messages = [''.padEnd(10, 'x')];
      expect(tf.validateMessages(messages)).to.deep.eql(messages);
    });
    it('truncates messages when length above max message length', () => {
      const tf = new TwilioFormatter();
      const msg = ''.padEnd(TwilioFormatter.MAX_MESSAGE_SIZE + 1, 'x');
      const truncated = msg.substring(0, TwilioFormatter.MAX_MESSAGE_SIZE);
      const messages = [msg];
      expect(tf.validateMessages(messages)).to.deep.eql([truncated]);
    });
  });
  describe('numberMessages(...)', () => {
    it('does not add a number prefix if there is only one message', () => {
      const tf = new TwilioFormatter();
      const messages = ['message 1'];
      expect(tf.numberMessages(messages)).to.deep.eql(messages);
    })
    it('adds a number prefix to messages if the array has length > 1', () => {
      const tf = new TwilioFormatter();
      const messages = ['message 1', 'message 2', 'message 3'];
      const expected = ['[1 of 3] message 1', '[2 of 3] message 2', '[3 of 3] message 3'];
      expect(tf.numberMessages(messages)).to.deep.eql(expected);
    });
  });

  describe('format(...)', () => {
    it('returns a TwiML MessagingResponse', () => {
      const tf = new TwilioFormatter();
      const messages = ['message 1', 'message 2', 'message 3'];
      expect(tf.format(messages)).to.be.instanceOf(MessagingResponse);
    });
    it('formats messages as TwiML messages in the Messaging Response', () => {
      const tf = new TwilioFormatter();
      const messages = ['message 1', 'message 2', 'message 3'];
      const formatted = tf.format(messages, false);
      const expected = '<?xml version="1.0" encoding="UTF-8"?><Response>' +
        messages.map((m) => `<Message>${m}</Message>`).join('') +
        '</Response>';
      expect(formatted.toString()).to.eql(expected);
    });
    it('numbers and formats messages as TwiML messages in the Messaging Response', () => {
      const tf = new TwilioFormatter();
      const messages = ['message 1', 'message 2', 'message 3'];
      const formatted = tf.format(messages);
      const expected = '<?xml version="1.0" encoding="UTF-8"?><Response>' +
        tf.numberMessages(messages)
          .map((m) => `<Message>${m}</Message>`)
          .join('') +
        '</Response>';
      expect(formatted.toString()).to.eql(expected);
    });
  });
});
