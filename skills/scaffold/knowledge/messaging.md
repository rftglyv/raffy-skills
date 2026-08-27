# Layer: Messaging & event streaming

**Do not confuse this with jobs.** A job is you calling yourself later; messaging is services
talking to each other. **One service never needs a broker.** Read
`../references/growth-ladders.md` and be honest about the service count before reading further.

Reaching for Kafka to send an email is the clearest single sign of an over-built stack.

### Direct HTTP (rung 0)
**Teaches:** service-boundaries, timeouts, retries
**Use when** — two or three services and synchronous calls are fine. The correct default.
**Don't use when** — a slow downstream service would block a user response, or a failure should not
lose the message.
**Gotcha:** always set a timeout. A call with no timeout is an outage waiting for a slow dependency.

### Postgres LISTEN/NOTIFY (rung 1)
**Docs:** https://postgresql.org/docs/current/sql-notify.html · **Teaches:** pub-sub, decoupling
Publish/subscribe inside the database you already run.
**Use when** — loose coupling between components sharing one database; cache invalidation; realtime
nudges.
**Don't use when** — you need durability. Notifications are dropped if nobody is listening.

### NATS + JetStream (rung 2)
**Docs:** https://docs.nats.io · **Teaches:** pub-sub, message-durability, at-least-once, streams
A single lightweight binary for pub/sub, request/reply, queue groups, and durable streams with
JetStream.
**Use when** — three or more services must talk asynchronously and you want the smallest possible
operational footprint.
**Don't use when** — one or two services · you need a long-retention replayable log for analytics.
**Adopt:** ~a day · **Remove later:** ~a week

### Kafka / Redpanda (rung 3)
**Docs:** https://kafka.apache.org/documentation · https://docs.redpanda.com
**Teaches:** event-log, partitions, consumer-groups, replay, ordering
An immutable, replayable, partitioned log. Redpanda is Kafka-compatible with no JVM or ZooKeeper.
**Use when** — multiple independent consumers must read the same event stream at their own pace ·
you need replay from an offset · genuinely high sustained throughput · event sourcing.
**Don't use when** — you want a queue. This is a log; the mental model and the operations are
different and heavier.
**Adopt:** days · **Remove later:** weeks

### RabbitMQ (rung 4)
**Docs:** https://rabbitmq.com/docs · **Teaches:** routing-topologies, acks, dead-letter-queues
**Use when** — complex routing rules, per-message TTL, and strong delivery semantics matter more
than throughput.
**Don't use when** — simple fan-out; NATS is lighter.

### Cloud queues — SQS · Pub/Sub · Service Bus
**Docs:** https://docs.aws.amazon.com/sqs · **Teaches:** managed-queues, visibility-timeout
**Use when** — you are already in that cloud and want zero operations.
**Don't use when** — you would be adopting the cloud for the queue.

### Realtime to the browser — WebSockets · SSE · Pusher · Ably
**Docs:** https://developer.mozilla.org/docs/Web/API/Server-sent_events
**Teaches:** realtime, connection-state, reconnection
**Use when** — live updates to users. **SSE first** — it is one-way, far simpler, and covers
notifications, progress and streaming LLM output. WebSockets only when the client must also push
continuously (chat, collaborative editing, multiplayer).
**Gotcha:** serverless platforms often cannot hold long-lived connections. Check the host before
choosing WebSockets, or use a managed service.
