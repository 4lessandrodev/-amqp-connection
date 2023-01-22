import Express from 'express';
import { Publisher } from './index';

const server = Express();
server.use(Express.json());

const service = Publisher.create({
    exchangeName: 'exchange-01',
    exchangeType: 'direct',
    url: 'amqp://username:password@localhost:5672',
    confirm: true,
    json: true
});

server.post('/', async (req, res) => {
    const result = await service.sendMessage({ content: { data: 'hello world'}, routingKey:'routing-key-01' })
    res.status(200).json({ ok: result });
});

server.listen(3000, () => console.log('running'));
