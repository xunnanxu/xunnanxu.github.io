---
title: Monitor gRPC Microservices in Kubernetes with Amazon X-Ray
date: 2018-11-25 14:11:39
categories:
- Operation
- Architecture
tags:
- monitoring
- grpc
- microservice
- kubernetes
- aws
- xray
coverImage: xray.png
coverMeta: out
coverSize: partial
---

Microservice architecture is typically useful to solve certain scaling problems where service decoupling/segregation is required to improve development velocity, make service more fault tolerant or handle performance hotspots.

However, everything comes with a price and so does microservice. One typical issue is:

<img src="{% asset_path ms-failure.png %}" style="width: 600px" />

While this is half joking, monitoring and fault resilency are definitely more challenging in microservice world. While there are frameworks like Hystrix and resilience4j to handle circuit breaking, rate limiting and stuff like that, this post focuses on the first thing: how the heck are my services talking to each other?

AWS X-Ray can fill the gap here by offering service mapping and tracing and thus you can see something like

{% asset_img xray.png %}

{% asset_img tracing.png %}

<!-- more -->

Compared to generic service monitoring,
X-Ray has some additional benefits around AWS ecosystem in that
it will auto expose your write (yes unfortunately) calls insights when you use AWS SDK.

But first of all, you need to understand how X-Ray works:

- X-Ray requires application to forward insights to the daemon.
  In EC2, this means the daemon process alongside with your application.
  In Kubenetes, this means you'd need to install it as a daemonset so it would run with your node.
- When a request enters the first service (typically an API gateway),
  the service is responsible for creating the first `segment` and generate the `trace ID`
  (typically created by AWS X-Ray SDK).
  A `segment` represents the overall lifecycle of a request within **one** application,
  identified by `segment ID`.
  A `trace ID` identifies the overall roundtrip of a request across **multiple** applications.
- A service, when making requests to other services,
  should generate corresponding `subsegment`s.
  A `subsegment` is used to identify activities within one application.
  This is not required for service mapping but nice to have for tracing purposes.
- A service, when accepting traffic from other services,
  should relay the trace ID and the previous segment ID (called parent ID in SDK).
  This is such that the service mapping can be generated.

For inter-service communication, gRPC is often used. Compared to JSON over REST, gRPC offers more flexibility around query design and better performance thanks to the efficiency of (de)serialization with protobuf and the usage of http2 multiplexing. The extra typing and backward compatibility from protobuf also help documentation and maintenance, improving the overall quality of service quorum.

However, while X-Ray SDK offers J2EE servlet filter for general http servers, gRPC does not follow that. The canonical [gRPC Java implementation](https://github.com/grpc/grpc-java) uses netty and has no knowledge around that.

This means we'd have to write some custom code. Unfortunately the documentation around that is [next to none](https://grpc.io/docs/quickstart/java.html). Luckily, gRPC has implicit support via `io.grpc.ServerInterceptor` and `io.grpc.ClientInterceptor` so it's just a matter of how to wire pieces together.

Overall there are 4 steps:

1. Set up Kubernetes daemonset
2. Grant permission to Kubernetes nodes so they can write metrics to X-Ray.
3. Write/use interceptors in code
4. Route metrics to X-Ray daemon

Let's do this step by step:

#### Set up Kubernetes daemonset

There's an example offered by Amazon regarding how to install it: [link](https://github.com/aws-samples/aws-xray-kubernetes)

#### Grant permission to Kubernetes nodes

This is a bit tricky depending how your kube cluster is set up.

If you use EKS/EC2, you need to grant X-Ray write permission by
attaching the canned policy to your IAM role for the worker nodes.

<img src="{% asset_path iam.png %}" style="width: 400px" />

If you host your kubenetes outside AWS ecosystem,
well chances are you don't need X-Ray but something generic like Istio's sidecar approach.
But if you do need it then you can create IAM users,
attach the policy and use these users in your code.

#### Write/use interceptors in code

First, we need to make sure we use the same language between server and client.
In typical HTTP this is the headers.
In gRPC this is the metadata, keyed by `Key`.

```java
public class Keys {

    public static final Metadata.Key<String> TRACE_ID_HEADER = Metadata.Key.of("traceId", Metadata.ASCII_STRING_MARSHALLER);
    public static final Metadata.Key<String> PARENT_ID_HEADER = Metadata.Key.of("parentId", Metadata.ASCII_STRING_MARSHALLER);

}
```

Now, let's implement client interceptor.

First you need some X-Ray stuff in classpath
(assuming Gradle is used for dependence managmement, should be similar for maven/ivy/sbt):

```groovy
dependencies {
  compile (
    "com.amazonaws:aws-xray-recorder-sdk-core",
    "com.amazonaws:aws-xray-recorder-sdk-aws-sdk",
  )
}
```

Note for demonstration purpose the verion is omitted here,
for actual usage you should peg the latest version at the time.

If you want X-Ray to instrument your AWS resource calls, you also need:

```groovy
compile("com.amazonaws:aws-xray-recorder-sdk-aws-sdk-instrumentor")
```

Now the code:

```java
public class XRayClientInterceptor implements ClientInterceptor {

    private final AWSXRayRecorder recorder = AWSXRayRecorderBuilder.defaultRecorder();

    @Override
    public <ReqT, RespT> ClientCall<ReqT, RespT> interceptCall(
            MethodDescriptor<ReqT, RespT> method, CallOptions callOptions, Channel next) {
        final Segment segment = recorder.getCurrentSegmentOptional().orElseGet(() -> {
            //noinspection CodeBlock2Expr
            return recorder.beginSegment(method.getFullMethodName());
        });
        final String segmentId = segment.getId();
        final String traceId = segment.getTraceId().toString();
        ClientCall<ReqT, RespT> call = next.newCall(method, callOptions);
        return new ForwardingClientCall.SimpleForwardingClientCall<ReqT, RespT>(call) {
            @Override
            public void start(Listener<RespT> responseListener, Metadata headers) {
                Subsegment callSegment = recorder.beginSubsegment(method.getFullMethodName());
                final Entity context = recorder.getTraceEntity();
                headers.discardAll(Keys.PARENT_ID_HEADER);
                headers.put(Keys.PARENT_ID_HEADER, segmentId);
                headers.put(Keys.TRACE_ID_HEADER, traceId);
                delegate().start(
                        new ForwardingClientCallListener.SimpleForwardingClientCallListener<RespT>(responseListener) {
                            @Override
                            public void onClose(io.grpc.Status status, Metadata trailers) {
                                if (status.getCause() != null) {
                                    callSegment.addException(status.getCause());
                                } else if (!status.isOk()) {
                                    callSegment.setError(true);
                                }
                                try {
                                    super.onClose(status, trailers);
                                } finally {
                                    Entity originalContext = recorder.getTraceEntity();
                                    recorder.setTraceEntity(context);
                                    try {
                                        callSegment.close();
                                    } finally {
                                        recorder.setTraceEntity(originalContext);
                                    }
                                }
                            }
                        },
                        headers);
            }
        };
    }
}
```

There's quite a lot of code here but the key gotchas are:

- You should always use an existing segment if one exists,
  which is what `getCurrentSegmentOptional()` is for.
  Fail to do so would result in the loss of previous segment.
  If in some other code the previous segment is still referenced,
  you will get missing context exceptions when trying to close it.
- Always bear in mind that data streaming/async handling is baked in gRPC design.
  So never close the segment directly after starting forwarding the client call.
  Instead, implement `ClientCallListener` and let gRPC tell you when
  it actually starts/finishes it.
- `AWSXRayRecorder` is thread safe so using one for all calls should be fine.
  However, all the segments are tracked via `ThreadLocalSegmentContext` by default.
  That is shared by **all** instances across the entire app by default
  even if you have multiple `AWSXRayRecorder` instances.
  What that implies is you should
  **always remember the corresponding context for that segment/subsegment**,
  especially when crossing threads. Failure to do so would result in weird errors.
  This is what `getTraceEntity()` and `setTraceEntity()` are for.
- The `put()` calls would append if key with the same name already exists.
  So remember to clean it up first.
  The trace ID meta doesn't need to be cleared because
  it's supposed to be the same as mentioned.

After that, wire it up when you build the client:

```java
newBlockingStub(channel).withInterceptors(new XRayClientInterceptor());
```

Next, let's build the server side interceptor:

This has some extra flavors in that it assumes you use a spring based
gRPC server like the [LogNet Springboot](https://github.com/LogNet/grpc-spring-boot-starter) one.
The `GRpcGlobalInterceptor` would tell the runner to inject the interceptor automagically.
If that's not the case, that's fine,
just replace the `appName` with some other logic,
and wire up the interceptor using `ServerInterceptors.intercept(serviceDefinition, interceptors)`.

```java
@GRpcGlobalInterceptor
public class XRayServerInterceptor implements ServerInterceptor {

    @Value("${spring.application.name}")
    private String appName;

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(ServerCall<ReqT, RespT> call, Metadata headers, ServerCallHandler<ReqT, RespT> next) {
        String traceId = headers.get(Keys.TRACE_ID_HEADER);
        String parentId = headers.get(Keys.PARENT_ID_HEADER);
        TraceID tId = new TraceID();
        if (traceId != null) {
            tId = TraceID.fromString(traceId);
        }
        Segment segment = recorder.beginSegment(appName, tId, parentId);
        headers.discardAll(Keys.PARENT_ID_HEADER);
        headers.discardAll(Keys.TRACE_ID_HEADER);
        headers.put(Keys.PARENT_ID_HEADER, segment.getId());
        headers.put(Keys.TRACE_ID_HEADER, tId.toString());
        ServerCall.Listener<ReqT> listener = next.startCall(call, headers);

        return new ForwardingListener<>(listener, call, recorder, recorder.getTraceEntity(), segment);
    }
}

public class ForwardingListener<T, R>
        extends ForwardingServerCallListener.SimpleForwardingServerCallListener<T> {

    private ServerCall<T, R> call;
    private AWSXRayRecorder recorder;
    private Entity entity;
    private Segment segment;

    public ForwardingListener(ServerCall.Listener<T> delegate,
            ServerCall<T, R> call,
            AWSXRayRecorder recorder,
            Entity entity,
            Segment segment
    ) {
        super(delegate);
        this.call = call;
        this.recorder = recorder;
        this.entity = entity;
        this.segment = segment;
    }

    @Override
    public void onCancel() {
        recorder.setTraceEntity(entity);
        if (call.isCancelled()) {
            return;
        }
        segment.setFault(true);
        try {
            super.onCancel();
        }
        finally {
            segment.close();
        }
    }

    @Override
    public void onComplete() {
        recorder.setTraceEntity(entity);
        try {
            super.onComplete();
        }
        catch (Throwable e) {
            segment.setError(true);
        }
        finally {
            segment.close();
        }
    }

}
```

#### Route metrics to X-Ray daemon

Last but not least, we need to tell X-Ray SDK to forward them to our daemon:

```yaml
    spec:
      containers:
      ...
        - name: ...
          env:
          - name: AWS_XRAY_DAEMON_ADDRESS 
            value: xray-daemon:2000
```

The value corresponds to your daemon name.

`AWS_XRAY_DAEMON_ADDRESS` will be read by AWS SDK at runtime.

#### Done

And that's it. Just deploy the apps to kube cluster.
Bear in mind that the service map is bound to time range.
It won't show up until you get traffic across your apps.
And if you have traffic split like A/B testing or service
migration, you'll see how things evolve over time,
which is pretty cool.
