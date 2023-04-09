import { ConsumeMessage } from "amqplib";
import { Consumer, Command, Options } from "./lib";

const command1: Command = {
    execute: async (data: ConsumeMessage, command: Options) => {
        console.log(data.fields.routingKey);
        console.log(data.content.toString());
        //await command.nack(data); // process again...
        await command.replyTo(data.properties.replyTo, 'hello world', data.properties.correlationId);
        await command.ack(data);
    }
}

const command2: Command = {
    execute: async (data: ConsumeMessage, command: Options) => {
        console.log(data.fields.routingKey);
        console.log(data.content.toString());
        await command.ack(data);
    }
}

const consumer = Consumer.create({
    exchangeName: 'exchange-01',
    exchangeType: 'direct',
    queueName: 'queue-01',
    url: 'amqp://username:password@localhost:5672',
});

consumer.createChannel({
    command: command1,
    json: true,
    prefetchCount: 0,
    routingKey: 'route01',
    durable: true,
    autoDelete: false
});

consumer.createChannel({
    command: command2,
    json: true,
    prefetchCount: 0,
    routingKey: 'route02',
    durable: true,
    autoDelete: false
});
