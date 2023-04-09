import amqp, { ConnectionUrl, Channel, ChannelWrapper } from 'amqp-connection-manager';
import { CreateChannelOpts } from 'amqp-connection-manager';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager';

type Type = 'direct' | 'fanout' | 'topic';

const c = '0123456789abcdef';
const randomUUID = () => { let id = ''; while (id.length < 32) { id = id + c[Math.floor(Math.random() * c.length)] } return id; }

interface Opts extends Omit<CreateChannelOpts, 'setup'> {
    url: ConnectionUrl;
    exchangeName: string;
    exchangeType: Type;
    autoDelete?: boolean;
    durable?: boolean;
}

export abstract class Publisher {
    private static connection: IAmqpConnectionManager;
    private static opts: Opts
    private static channel: ChannelWrapper;

    public static async create(opt: Opts): Promise<typeof Publisher> {
        Publisher.opts = opt;
        await Publisher.connect();
        return Publisher;
    }

    private static async connect(): Promise<void> {
        if (Publisher.connection && Publisher.connection.isConnected()) return;
        return new Promise((resolve, reject): void => {
            this.connection = amqp.connect([Publisher.opts.url], { heartbeatIntervalInSeconds: 10 });
            this.connection.on('connect', async (): Promise<void> => {
                console.log('connected');
                await Publisher.createChannel();
                resolve();
            });
            this.connection.on('connectFailed', (e): void => {
                console.log('connection fails: ', e);
                reject(e);
            });
            this.connection.on('disconnect', (): void => {
                Publisher.connection.reconnect();
            });
        });
    }

    private static async createChannel(): Promise<void> {
        if (!!Publisher.connection?.isConnected || !Publisher.connection.isConnected()) {
            await Publisher.connect();
        }
        Publisher.channel = Publisher.connection.createChannel({
            json: Publisher.opts.json,
            publishTimeout: Publisher.opts.publishTimeout ?? 9000,
            setup: (channel: Channel): void => {
                channel.assertExchange(Publisher.opts.exchangeName, Publisher.opts.exchangeType, {
                    durable: Publisher.opts.durable,
                    autoDelete: Publisher.opts.autoDelete
                })
            }
        });
        Publisher.channel.on('error', async (): Promise<void> => {
            await Publisher.channel.close();
            Publisher.connection.close();
            await Publisher.connect();
        });
    }

    public static async sendMessage<T>(data: { content: T, routingKey: string }): Promise<boolean> {
        return await Publisher.channel.publish(Publisher.opts.exchangeName, data.routingKey, { data: data.content });
    }

    public static async sendRequest<T>(data: { content?: T, consumerQueue: string, routingKey: string }): Promise<string | null> {
        let payload = null;
        const correlationId = randomUUID();

        await Publisher.connect();

        const { queue } = await Publisher.channel.assertQueue('', {
            exclusive: true,
            autoDelete: true,
            durable: false,
            expires: 30000,
            messageTtl: 30000,
            arguments: {
                'x-expires': 30000,
            }
        });

        await Publisher.channel.sendToQueue(data.consumerQueue, data.content ?? '', {
            correlationId: correlationId,
            replyTo: queue,
            headers: { routingKey: data.routingKey }
        });

        await Publisher.channel.consume(queue, (msg): string | null => {
            if (msg.properties.correlationId === correlationId) {
                Publisher.channel.ack(msg);
                payload = JSON.parse(msg.content.toString());
                return payload;
            }
            payload = null;
            return payload;
        });

        await Publisher.channel.deleteQueue(queue);
        return payload;
    }

    private constructor() { }
}

export default Publisher;
