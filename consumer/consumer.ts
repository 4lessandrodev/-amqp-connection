import { ConsumeMessage } from "amqplib";
import { Consumer, Command, Options } from "./index";

const command1: Command = {
    execute: async (data: ConsumeMessage, command: Options) => {
        console.log("route01");
        console.log(data.content.toString());
        await command.nack(data);
    }
}

const command2: Command = {
    execute: async (data: ConsumeMessage, command: Options) => {
        console.log("route02");
        console.log(data.content.toString());
        command.ack(data);
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
    prefetchCount: 60,
    routingKey: 'route01',
});

consumer.createChannel({
    command: command2,
    json: true,
    prefetchCount: 60,
    routingKey: 'route02',
});
