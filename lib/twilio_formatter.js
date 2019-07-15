import { twiml } from 'twilio';
const MessagingResponse = twiml.MessagingResponse;

/**
 * A class that takes a collection of text messages to be sent
 * and formats them for output in Twilio TwiML MessagingResponse
 * XML format
 */
class TwilioFormatter {
  /**
   * Class constructor
   * @returns {TwilioFormatter} - the TwilioFormatter object
   */
  constructor () { }

  /**
   * Generate a Twilio XML MessagingResponse from an array of messages
   * @param {Array<string>} messages - an array of SMS messages to be sent
   * @param {boolean} numberMessages - (optional) whether or not to number messages before formatting (default: true)
   * @returns {MessagingResponse} - the formatted MessageResponse
   */
  format (messages, numberMessages = true) {
    let validatedMessages;
    if (numberMessages) {
      const numberedMessages = this.numberMessages(messages);
      validatedMessages = this.validateMessages(numberedMessages);
    } else {
      validatedMessages = this.validateMessages(messages);
    }
    const messagingResponse = new MessagingResponse();
    for (let msg of validatedMessages) {
      messagingResponse.message(msg);
    }
    return messagingResponse;
  }

  /**
   * Add numbering prefixes (e.g., "[1 of 5] ") to collections of more than one message
   * @param {Array<string>} messages - messages to be numbered
   * @returns {Array<string>} - array of numbered messages
   */
  numberMessages (messages) {
    if (messages.length === 1) return messages;
    return messages.map((message, idx, ary) => `[${idx + 1} of ${ary.length}] ${message}`);
  }

  /**
   * Validate messages for length, and truncate if needed
   * @param {Array<string>} messages - messages to be validated
   * @returns {Array<string>} - the validated (and truncated if needed) messages
   */
  validateMessages (messages) {
    const validatedMessages = [];
    for (let msg of messages) {
      if (msg.length > TwilioFormatter.MAX_MESSAGE_SIZE) {
        console.error(`ERROR SENDING MESSAGE: Message length of ${msg.length} exceeds Twilio message character limit of 1600 characters for message "${msg}"`);
      }
      validatedMessages.push(msg.substring(0, TwilioFormatter.MAX_MESSAGE_SIZE));
    }
    return validatedMessages;
  }
}

/**
 * Twilio maximum sendable message length in characters.
 */
TwilioFormatter.MAX_MESSAGE_SIZE = 1600;

export default TwilioFormatter;