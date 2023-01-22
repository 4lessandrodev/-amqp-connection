# Testando rabbitmq - Sem Framework

Conexão direta com amqp sem usar nenhum framework

> Referência: [Documentação](https://www.rabbitmq.com/tutorials/tutorial-three-javascript.html)

---

## Rodar o projeto

Requisitos:

- NodeJS V14+ [here](https://nodejs.org/en/download/)
- yarn [here](https://classic.yarnpkg.com/lang/en/docs/install/#debian-stable)
- docker [here](https://docs.docker.com/engine/install/ubuntu/)
- docker-compose [here](https://docs.docker.com/compose/install/)
- linux, wsl or mac
- build-essentials [here](https://linuxhint.com/install-build-essential-ubuntu/)

---

### Padrão de conexão com rabbitMQ

Padrão seguindo o conceito de publisher / subscriber.

Criando o cliente

```ts

// PUBLISHER

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


```

### Consumer

Criando o microservice consumer para consumir as mensagens

```ts

// SUBSCRIBER

import { ConsumeMessage } from "amqplib";
import { Consumer, Command, Options } from "./lib";

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


```


### Primeiros passos

Clone o projeto e exetute os passos

- Installar as dependências
- Execute o container rabbitmq `docker-compose up -d`
- Execute os dois projetos `consumer` e `publisher`

Enviando dados para a routing-key-01

```sh

curl --location --request POST 'http://localhost:3000/route01' \
--header 'Content-Type: application/json' \
--data-raw '{
    "some": "any data to route 1"
}'

```

Enviando dados para a routing-key-02

```sh

curl --location --request POST 'http://localhost:3000/route02' \
--header 'Content-Type: application/json' \
--data-raw '{
    "some": "any data to route 2"
}'

```