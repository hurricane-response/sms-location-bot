
# Hurricane Response SMS Shelter Location Bot

This project is part of the [Code for America Hurricane Response effort](https://www.hurricane-response.org).

As part of this effort, in response to hurricanes and similar disasters, we work to provide up-to-date and accurate information on available shelters and food/water distribution points for those in affected areas.

## The Problem

Often, during a hurricane and its aftermath, internet can be unreliable for communication. In these cases, an alternative that can be more reliable is SMS text messaging.

## What This Project Does

This project uses data from our API (see [hurricane-response/florence-api](https://github.com/hurricane-response/florence-api)), along with Twilio text messaging services, to provide a queriable SMS text message interface for shelter location information.

![Sample SMS interaction](./sms-location-bot-example.png "Robots love to help!")
`I’m a bot! You send me a zip code via SMS, and I reply with the nearest location I know of for the thing I know how to locate.`

To use it, you can query by sending a message with a zip code in it. You will get back a series of messages with a list of known shelters and their information.

## Contributing

We welcome your contributions! Take a look at our [Code of Conduct](Code_of_Conduct.md), then read our [Contributing](CONTRIBUTING.md) doc to get started!

## License

This code is licensed under the MIT license. More details in the [LICENSE](LICENSE) file.
