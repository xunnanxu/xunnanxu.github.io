---
title: "Workflow Processing Engine Overview 2018: Airflow vs Azkaban vs Conductor vs Oozie vs Amazon Step Functions"
date: 2018-04-13 21:33:33
tags:
    - opensource
    - workflow
    - aws
    - airflow
    - azkaban
    - review
---
|                                 | Airflow                                | Azkaban                                         | Conductor                      | Oozie                                      | Step Functions                      |
|:-------------------------------:|----------------------------------------|-------------------------------------------------|--------------------------------|--------------------------------------------|-------------------------------------|
|            **Owner**            | Apache<br>(previously Airbnb)          | LinkedIn                                        | Netflix                        | Apache                                     | Amazon                              |
|          **Community**          | Very Active                            | Somewhat active                                 | Active                         | Active                                     | N/A                                 |
|           **History**           | 4 years                                | 7 years                                         | 1.5 years                      | 8 years                                    | 1.5 years                           |
|         **Main Purpose**        | General Purpose Batch Processing       | Hadoop Job Scheduling                           | Microservice orchestration     | Hadoop Job Scheduling                      | General Purpose Workflow Processing |
|       **Flow Definition**       | Python                                 | Custom DSL                                      | JSON                           | XML                                        | JSON                                |
|   **Support for single node**   | Yes                                    | Yes                                             | Yes                            | Yes                                        | N/A                                 |
|       **Quick demo setup**      | Yes                                    | Yes                                             | Yes                            | No                                         | N/A                                 |
|        **Support for HA**       | Yes                                    | Yes                                             | Yes                            | Yes                                        | Yes                                 |
|   **Single Point of Failure**   | Yes<br>(Single scheduler)              | Yes<br>(Single web and scheduler combined node) | No                             | No                                         | No                                  |
|     **HA Extra Requirement**    | Celery/Dask/Mesos + Load Balancer + DB | DB                                              | Load Balancer (web nodes) + DB | Load Balancer (web nodes) + DB + Zookeeper | Native                              |
|           **Cron Job**          | Yes                                    | Yes                                             | No                             | Yes                                        | Yes                                 |
|       **Execution Model**       | Push                                   | Push                                            | Poll                           | Poll                                       | Unknown                             |
|       **Rest API Trigger**      | Yes                                    | Yes                                             | Yes                            | Yes                                        | Yes                                 |
|   **Parameterized Execution**   | Yes                                    | Yes                                             | Yes                            | Yes                                        | Yes                                 |
|  **Trigger by External Event**  | Yes                                    | No                                              | No                             | Yes                                        | Yes                                 |
| **Native Waiting Task Support** | Yes                                    | No                                              | Yes (external signal required) | No                                         | Yes                                 |
|     **Backfilling support**     | Yes                                    | No                                              | No                             | Yes                                        | No                                  |
|  **Native Web Authentication**  | LDAP/Password                          | XML Password                                    | No                             | No                                         | No                                  |
|          **Monitoring**         | Yes                                    | Limited                                         | Limited                        | Yes                                        | Limited                             |
|         **Scalability**         | Depending on executor setup            | Good                                            | Very Good                      | Very Good                                  | Very Good                           |

## Disclaimer
I'm not an expert in any of those engines.
I've used some of those (Airflow & Azkaban) and checked the code.
For some others I either only read the code (Conductor) or the docs (Oozie/AWS Step Functions).
As most of them are OSS projects, it's certainly possible that I might have missed certain undocumented features,
or community-contributed plugins. I'm happy to update this if you see anything wrong.

Bottom line: Use your own judgement when reading this post.

## Airflow

### The Good
Airflow is a super feature rich engine compared to all other solutions.
Not only you can use plugins to support all kinds of jobs,
ranging from data processing jobs: Hive, Pig (though you can also submit them via shell command),
to general flow management like triggering by existence of file/db entry/s3 content,
or waiting for expected output from a web endpoint,
but also it provides a nice UI that allows you to check your DAGs (workflow dependencies) through code/graph,
and monitors the real time execution of jobs.

Airflow is also highly customizable with a currently vigorous community.
You can run all your jobs through a single node using local executor,
or distribute them onto a group of worker nodes through Celery/Dask/Mesos orchestration.

### The Bad
Airflow by itself is still not very mature (in fact maybe Oozie is the only "mature" engine here).
The scheduler would need to periodically poll the scheduling plan and send jobs to executors.
This means it along would continuously dump enormous amount of logs out of the box.
As it works by "ticking", your jobs are not guaranteed to get scheduled in "real-time" if that makes sense
and this would get worse as the number of concurrent jobs increases.
Meanwhile as you have one centralized scheduler, if it goes down or gets stuck, your running jobs won't be
affected as that the job of executors, but no new jobs will get scheduled. This is especially confusing when
you run this with a HA setup where you have multiple web nodes, a scheduler, a broker
(typically a message queue in Celery case), multiple executors. When scheduler is stuck for whatever reason,
all you see in web UI is all tasks are running, but in fact they are not actually moving forward while executors
are happily reporting they are fine. In other words, the default monitoring is still far from bullet proof.

The web UI is very nice from the first look. However it sometimes is confusing to new users.
What does it mean my DAG runs are "running" but my tasks have no state? The charts are not search friendly either,
let alone some of the features are still far from well documented
(though the document does look nice, I mean, compared to Oozie, which does seem out-dated).

The backfilling design is good in certain cases but very error prone in others.
If you have a flow with cron schedules disabled and re-enabled later, it would try to play catch up,
and if your jobs is not designed to be idempotent, shit would happen for real.

## Azkaban

### The Good
Of all the engines, Azkaban is probably the easiest to get going out of the box.
UI is very intuitive and easy to use. Scheduling and REST APIs works just fine.

Limited HA setup works out of the box.
There's no need for load balancer because you can only have one web node.
You can configure how it selects executor nodes to push jobs to and it generally seems to scale pretty nicely.
You can easily run tens of thousands of jobs as long as you have enough capacity for the executor nodes.

### The Bad
It is not very feature rich out of the box as a general purpose orchestration engine,
but likely that's not what's originally designed for. It's strength lies in native support for Hadoop/Pig/Hive,
though you can also achieve those using command line. But itself cannot trigger jobs through external resources like
Airflow, nor does it support job waiting pattern. Although you can do busy waiting through java code/scripts, that
leads to bad resource utilization.

The documentation and configuration are generally a bit confusing compared to others. It's likely that it wasn't supposed
to be OSed at the beginning. The design is okish but you better have a big data center to run the executors as scheduling 
would get stalled when executors run out of resources without extra monitoring stuff. The code quality overall is a bit towards
the lower end compared to others so it generally only scales well when resource is not a problem.

The setup/design is not cloud friendly. You are pretty much supposed to have stable bare metal rather than dynamically
allocated virtual instances with dynamic IPs. Scheduling would go south if machines vanish.

The monitoring part is sort of acceptable through JMX (does not seem documented). But it generally doesn't work well if your
machines are heavily loaded, unfortunately, as the endpoints may get stuck.

## Conductor

### The Good
It's a bit unfair to put Conductor into this competition as it's real purpose is for microservice orchestration, whatever that means.
It's HA model involves a quorum of servers sitting behind load balancer putting tasks onto a message queue which the worker nodes would
poll from, which means it's less likely you'll run into stalled scheduling.
With the help of parameterized execution through API, it's actually quite good at scheduling and scaling provided
that you set up your load balancer/service discovery layer properly.

### The Bad
The UI needs a bit more love. There's currently very limited monitoring there. Although for general purpose scheduling that's probably
good enough.

It's pretty bare-bone out of the box. There's not even native support for running shell scripts, though it's pretty easy to implement
a task worker through python to do the job with the examples provided.

## Oozie

### The Good
Oozie provides a seemingly reliable HA model through the db setup (seemingly b/c I've not dug into it).
It provides native support for Hadoop related jobs as it was sort of built for that eco system.

### The Bad
Not a very good candidate for general purpose flow scheduling as the XML definition is quite verbose
and cumbersome for defining light weight jobs.

It also requires quite a bit of peripheral setup. You need a zookeeper cluster, a db, a load balancer
and each node needs to run a web app container like Tomcat. The initial setup also takes some time which is
not friendly to first time users to pilot stuff.

## Step Functions

### The Good
Step Functions is fairly new (launch in Dec 2016). However the future seems promising. With the HA nature of cloud
platform and lambda functions, it almost feels like it can easily scale infinitely (compared to others).

It also offers some useful features for general purpose workflow handling like waiting support and dynamic branching
based on output.

It's also fairly cheap:

- 4,000 state transitions are free each month
- $0.025 per 1,000 state transitions thereafter ($0.000025 per state transition)

If you don't run tens of thousands of jobs, this might be even better than running your own cluster of things.

### The Bad
Can only be used by AWS users. Deal breaker if you are not one of them yet.

Lambda requires extra work for production level iteration/deployment.

There's no UI (well there is but it's really just a console).
So if you need any level of monitoring beyond that you need to build it using cloudwatch by yourself.
