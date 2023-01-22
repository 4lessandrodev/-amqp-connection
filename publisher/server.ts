import Express from 'express';
import { Publisher } from './lib';

const server = Express();
server.use(Express.json());

const service = Publisher.create({
    exchangeName: 'exchange-01',
    exchangeType: 'direct',
    url: 'amqp://username:password@localhost:5672',
    json: true,
});

server.post('/route01', async (req, res) => {
    const result = await service.sendMessage({ content: { data: req.body }, routingKey:'route01' })
    res.status(200).json({ ok: result });
});

server.post('/route02', async (req, res) => {
    const result = await service.sendMessage({ content: req.body, routingKey:'route02' })
    res.status(200).json({ ok: result });
});

server.listen(3000, () => console.log('running'));
