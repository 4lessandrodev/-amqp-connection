import amqp, { Channel, ChannelWrapper } from 'amqp-connection-manager';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager';
import { ConsumeMessage, Replies } from 'amqplib';

type Type = 'direct' | 'fanout' | 'topic';
export interface Options {
    ack: (data: ConsumeMessage) => Promise<void>;
    nack: (data: ConsumeMessage) => Promise<void>;
    replyTo: (queueName: string, data: string | Buffer | {}, correlationId: string) => Promise<void>;
}

export abstract class Command {
    abstract execute: (data: ConsumeMessage, command: Options) => Promise<any>;
}

interface ChannelOps {
    autoDelete?: boolean;
    routingKey: string;
    prefetchCount: number;
    command: Command;
    json: boolean;
    durable?: boolean;
    publishTimeout?: number;
}

interface InfoOps {
    url: string;
    queueName: string;
    exchangeName: string;
    exchangeType: Type;
}

export class Consumer {
    private static connection: IAmqpConnectionManager;
    private static opts: InfoOps;
    private static wrappers: Map<string, ChannelWrapper>;
    private static dispatchs: Map<string, Command>;
    private static wrapper: ChannelWrapper;

    public static create(opts: InfoOps): typeof Consumer {
        Consumer.opts = opts;
        if (Consumer.connection && Consumer.connection.isConnected()) return this;
        Consumer.connect();
        Consumer.wrappers = new Map();
        Consumer.dispatchs = new Map();
        return this;
    }

    private static connect(): void {
        Consumer.connection = amqp.connect([Consumer.opts.url], { heartbeatIntervalInSeconds: 10 });
        Consumer.connection.on('connect', () => console.log('consumer connected'));
        Consumer.connection.on('connectFailed', (e) => console.log(e));
        Consumer.connection.on('disconnect', Consumer.connection.reconnect);
    }

    private static async onMessage(data: ConsumeMessage | null): Promise<Replies.Consume> {
        const routingKey = data?.properties?.headers?.['routingKey'];
        const event = routingKey ?? data?.fields.routingKey ?? 'message';
        const ack = async (msg: ConsumeMessage): Promise<void> => Consumer.wrappers.forEach(async (wrapper): Promise<void> => await wrapper.ack(msg));
        const nack = async (msg: ConsumeMessage): Promise<void> => Consumer.wrappers.forEach(async (wrapper): Promise<void> => await wrapper.nack(msg));
        const replyTo = async (queue: string, content: string | Buffer | {}, correlationId: string): Promise<void> => {
            await Consumer.wrapper.sendToQueue(queue, content, { correlationId });
        };
        const command = Consumer.dispatchs.get(event) as Command;
        await command.execute(data as ConsumeMessage, { ack, nack, replyTo });
        return { consumerTag: data?.fields.consumerTag ?? '' };
    }

    public static createChannel(opt: ChannelOps): ChannelWrapper {
        const wrapper = Consumer.connection.createChannel({
            json: opt.json,
            publishTimeout: opt.publishTimeout,
            setup: (channel: Channel) => {
                return Promise.all([
                    channel.assertQueue(Consumer.opts.queueName, { autoDelete: opt.autoDelete, durable: opt.durable }),
                    channel.assertExchange(Consumer.opts.exchangeName, Consumer.opts.exchangeType),
                    channel.prefetch(opt.prefetchCount),
                    channel.bindQueue(Consumer.opts.queueName, Consumer.opts.exchangeName, opt.routingKey),
                    channel.consume(Consumer.opts.queueName, Consumer.onMessage),
                ])
            }
        });
        const log = (): void => console.log(`routing ${opt.routingKey} listening`);
        wrapper.waitForConnect().then(log);
        wrapper.on('error', (): void => {
            process.nextTick((): void => {
                console.log('processing...');
            });
        });
        Consumer.wrappers.set(opt.routingKey, wrapper);
        Consumer.dispatchs.set(opt.routingKey, opt.command);
        Consumer.wrapper = wrapper;
        return wrapper;
    }
}

export default Consumer;