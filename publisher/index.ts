import amqp, { ConnectionUrl, Channel, ChannelWrapper } from 'amqp-connection-manager';
import { CreateChannelOpts, AmqpConnectionManager } from 'amqp-connection-manager';

type Type = 'direct' | 'fanout' | 'topic';
type Connection = { url: ConnectionUrl, exchangeName: string, exchangeType: Type };

export abstract class Publisher {
    private static connection: AmqpConnectionManager;
    private static opts: CreateChannelOpts & Connection;
    private static channel: ChannelWrapper;

    public static create(opt: Connection & Omit<CreateChannelOpts, 'setup'>): typeof Publisher {
        Publisher.opts = opt;
        Publisher.connect();
        return Publisher;
    }

    private static connect(): void {
        if(Publisher.connection && Publisher.connection.isConnected()) return;
        this.connection = amqp.connect([Publisher.opts.url]);
        this.connection.on('connect', () => { console.log('connected'); Publisher.createChannel(); });
        this.connection.on('connectFailed', (e) => console.log('connection fails: ', e));
        this.connection.on('disconnect', () => Publisher.connection.reconnect());
    }

    private static createChannel(): void {
        if(!!Publisher.connection?.isConnected || !Publisher.connection.isConnected()){
            Publisher.connect();
        }
        Publisher.channel = Publisher.connection.createChannel({
            confirm: Publisher.opts.confirm,
            json: Publisher.opts.json,
            name: Publisher.opts.name ?? 'default',
            publishTimeout: Publisher.opts.publishTimeout ?? 9000,
            setup: (channel: Channel) => {
                channel.assertExchange(Publisher.opts.exchangeName, Publisher.opts.exchangeType)
            }
        });
        Publisher.channel.on('error', async () => { 
            await Publisher.channel.close(); 
            Publisher.connection.close();
            Publisher.connect();
        });
    }

    public static async sendMessage<T>(data: { content: T, routingKey: string }): Promise<boolean> {
        return await Publisher.channel.publish(Publisher.opts.exchangeName, data.routingKey, { data: data.content });
    }

    private constructor(){}
}

export default Publisher;
