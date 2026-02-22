"""面试前快速复盘小抄（预设内容）。

说明:
- 该文件维护 7 个核心模块的“主线节点 + 核心记忆点”，用于考前快速过一遍。
- 预设内容不依赖题库导入，避免“再列一遍题目”的体验。
"""


QUICK_REVIEW_PRESETS = {
    'JVM': {
        'summary': '内存区域 → 类加载 → GC → JMM → 调优',
        'nodes': [
            {
                'key': 'memory-areas',
                'title': '内存区域划分',
                'points': [
                    '五大区域：程序计数器 / 虚拟机栈 / 本地方法栈 / 堆 / 方法区（元空间）',
                    '对象创建：TLAB、指针碰撞/空闲列表、对象头（Mark Word/Klass Pointer）',
                    '常见 OOM：堆、栈、元空间、直接内存；区分“内存泄漏 vs 内存溢出”',
                    '字符串常量池位置与 JDK8 元空间变化要能说清楚',
                ],
            },
            {
                'key': 'class-loading',
                'title': '类加载机制',
                'points': [
                    '双亲委派模型：目的（安全、避免重复）与破坏场景（Tomcat、SPI）',
                    '生命周期：加载 → 验证 → 准备 → 解析 → 初始化 → 使用 → 卸载',
                    '类加载器体系：Bootstrap / Ext / App / 自定义；命名空间隔离',
                    '触发初始化的典型场景：new/getstatic/putstatic/invokestatic/反射等',
                ],
            },
            {
                'key': 'gc',
                'title': '垃圾回收算法与收集器',
                'points': [
                    '可达性分析 + GC Roots（而不是引用计数）',
                    '算法：标记清除 / 复制 / 标记整理；分代回收基本逻辑',
                    'Minor/Young GC、Mixed GC、Full GC 的触发与影响（STW）',
                    '常见收集器主线：CMS（低停顿）→ G1（区域化）→ ZGC（更低停顿）',
                ],
            },
            {
                'key': 'jmm',
                'title': 'JMM（Java 内存模型）',
                'points': [
                    '并发三要素：原子性 / 可见性 / 有序性；happens-before 规则',
                    'volatile：可见性 + 禁止重排序（不保证复合操作原子性）',
                    'synchronized/Lock：互斥 + 可见性；了解锁升级与常见优化方向',
                    '指令重排、内存屏障、as-if-serial 思维模型',
                ],
            },
            {
                'key': 'tuning',
                'title': 'JVM 调优与排障',
                'points': [
                    '看指标：停顿时间/吞吐、GC 频率、CPU、RT、堆外内存、线程数',
                    '常用工具：jps/jstack/jmap/jcmd/jstat、arthas、GC log、heap dump',
                    '参数主线：Xms/Xmx、G1 MaxGCPauseMillis、MetaSpace、直接内存等',
                    '问题拆解：OOM、频繁 Full GC、内存泄漏（MAT/引用链）',
                ],
            },
        ],
    },
    'Redis': {
        'summary': '数据结构 → 持久化 → 复制高可用 → 集群扩展 → 缓存一致性与实战',
        'nodes': [
            {
                'key': 'data-structure',
                'title': '数据结构与底层编码',
                'points': [
                    '五大类型：String/List/Hash/Set/ZSet 的适用场景与常见坑',
                    '底层编码：hashtable、skiplist、intset、listpack/ziplist 等（知道即可）',
                    '复杂度与性能：O(1)/O(logN) 的取舍，避免滥用全量扫描命令',
                    'bigkey/hotkey：定义、风险（阻塞、网络、内存）与治理手段',
                ],
            },
            {
                'key': 'persistence',
                'title': '持久化（RDB/AOF）',
                'points': [
                    'RDB：快照触发、fork 开销、优缺点与丢数据窗口',
                    'AOF：appendfsync 策略、AOF 重写、混合持久化（RDB+AOF）',
                    '恢复流程：RDB/AOF 的加载优先级与重放成本',
                ],
            },
            {
                'key': 'ha',
                'title': '复制与高可用（主从/哨兵）',
                'points': [
                    '复制链路：全量/增量复制、PSYNC、复制积压缓冲区、复制延迟',
                    '哨兵：监控/选主/故障转移流程；脑裂风险与读写策略',
                ],
            },
            {
                'key': 'cluster',
                'title': 'Cluster 与扩展',
                'points': [
                    '16384 slot、分片与迁移；MOVED/ASK 的含义与客户端处理',
                    '多 key 限制与 hash tag；热点分片与扩容思路',
                ],
            },
            {
                'key': 'cache-practice',
                'title': '缓存一致性与实战',
                'points': [
                    'Cache Aside：读写流程、双删/延迟双删的目的与边界',
                    '三大问题：穿透/击穿/雪崩（布隆/互斥/限流/预热/随机 TTL）',
                    '过期与淘汰：lazy/定期删除、淘汰策略（volatile/allkeys）',
                    '性能：pipeline、lua、批量、慢查询与监控',
                ],
            },
        ],
    },
    '数据库': {
        'summary': '事务隔离 → 索引执行 → 锁与并发 → 日志恢复 → 架构与调优',
        'nodes': [
            {
                'key': 'tx-isolation',
                'title': '事务与隔离级别',
                'points': [
                    'ACID 与 4 种隔离级别；分别解决哪些现象（脏读/不可重复读/幻读）',
                    'InnoDB 默认 RR；理解 MVCC 的价值（读不加锁的并发能力）',
                ],
            },
            {
                'key': 'index-explain',
                'title': '索引与执行计划',
                'points': [
                    'B+Tree、聚簇索引/二级索引；回表与覆盖索引',
                    '最左前缀、索引下推（ICP）、联合索引设计顺序',
                    'explain 关注：type/key/rows/extra（Using index/Using filesort）',
                ],
            },
            {
                'key': 'locks-mvcc',
                'title': '锁与并发控制',
                'points': [
                    '行锁/表锁/意向锁；间隙锁、Next-Key Lock 与“防幻读”',
                    '死锁：检测与处理；减少锁范围、固定顺序、缩短事务',
                ],
            },
            {
                'key': 'logs-recovery',
                'title': '日志与崩溃恢复（redo/undo/binlog）',
                'points': [
                    'redo log（WAL）保证持久性；undo log 用于回滚与 MVCC',
                    'binlog 用于复制与恢复；两阶段提交保证一致性',
                    'checkpoint 与崩溃恢复基本流程（理解即可）',
                ],
            },
            {
                'key': 'arch-tuning',
                'title': '高可用与调优/架构',
                'points': [
                    '主从复制/读写分离：延迟、一致性与切换策略',
                    '慢查询与 SQL/索引优化：先定位再改写，不迷信“加索引”',
                    '分库分表：路由、全局 ID、跨分片事务/查询的代价与方案',
                ],
            },
        ],
    },
    '消息队列': {
        'summary': '模型语义 → 顺序分区 → 可靠性链路 → 高可用扩展 → 监控运维',
        'nodes': [
            {
                'key': 'model-semantics',
                'title': '核心模型与投递语义',
                'points': [
                    'Producer/Broker/Consumer；Topic/Queue/Partition（顺序粒度由此决定）',
                    '消费模型：Consumer Group、push/pull、offset/ack 的角色',
                    '投递语义：至多一次/至少一次/恰好一次（代价与边界）',
                ],
            },
            {
                'key': 'order-partition',
                'title': '顺序、分区与重平衡',
                'points': [
                    '“全局顺序”很贵，常见是“同 key 顺序/同分区顺序”',
                    '重平衡会影响顺序与延迟；要能说明如何减小影响',
                ],
            },
            {
                'key': 'reliability',
                'title': '可靠性链路（ACK/重试/死信/幂等）',
                'points': [
                    '生产端：重试、确认机制；消费端：手动提交、失败重试',
                    '死信队列（DLQ）与补偿流程',
                    '幂等与去重：业务唯一键、去重表/状态机（核心）',
                ],
            },
            {
                'key': 'ha-scale',
                'title': '高可用与扩展（副本/积压治理）',
                'points': [
                    '副本/主从/ISR（Kafka）或主从集群（RocketMQ）主线理解即可',
                    '消息积压：扩容消费者、批量拉取、限流降载、关注 lag',
                ],
            },
            {
                'key': 'ops',
                'title': '监控与实战场景',
                'points': [
                    '关键指标：TPS、消费 lag、失败率、重试率、磁盘/网络水位',
                    '典型场景：延迟消息、事务消息/Outbox、回溯消费',
                ],
            },
        ],
    },
    '并发编程': {
        'summary': '问题模型 → 锁体系 → AQS 队列 → CAS 原子 → 线程池实战',
        'nodes': [
            {
                'key': 'concurrency-model',
                'title': '并发基础与问题模型',
                'points': [
                    '三要素：原子性/可见性/有序性；happens-before 的判断方法',
                    'volatile vs synchronized vs Lock：分别解决什么问题',
                ],
            },
            {
                'key': 'locks',
                'title': '锁体系（synchronized/Lock/读写锁）',
                'points': [
                    'synchronized：对象头、monitor、锁升级（偏向/轻量/重量）',
                    'ReentrantLock：公平/非公平、Condition；读写锁的适用场景',
                ],
            },
            {
                'key': 'aqs-queue',
                'title': 'AQS 与阻塞队列',
                'points': [
                    'AQS：state + CLH 队列；独占/共享模式',
                    '典型组件：Semaphore/CountDownLatch/ReentrantLock 的共同主线',
                    'BlockingQueue：Array/Linked/Synchronous 的差异与使用场景',
                ],
            },
            {
                'key': 'cas-atomic',
                'title': 'CAS 与原子类',
                'points': [
                    'CAS、ABA 问题与解决（版本号/Stamped）',
                    'Atomic* 与 LongAdder 的适用场景（高并发计数）',
                ],
            },
            {
                'key': 'threadpool',
                'title': '线程池与排障实战',
                'points': [
                    '参数：core/max/queue/reject/keepAlive；提交流程要能讲清楚',
                    '常见拒绝策略与“保护系统”的思路（而不是硬撑）',
                    '排查：死锁、CPU 100%、线程爆炸（jstack/arthas）',
                ],
            },
        ],
    },
    'Spring': {
        'summary': 'IOC 容器 → AOP 代理 → 事务 → MVC → Boot 自动装配',
        'nodes': [
            {
                'key': 'ioc',
                'title': 'IOC 容器与 Bean 生命周期',
                'points': [
                    'BeanDefinition、扫描注册、实例化、依赖注入（整体链路）',
                    '生命周期：Aware / InitializingBean / BeanPostProcessor 的作用点',
                    '循环依赖：三级缓存解决思路与边界（构造器注入不行）',
                ],
            },
            {
                'key': 'aop',
                'title': 'AOP 与代理机制',
                'points': [
                    'JDK 动态代理 vs CGLIB；各自前提与限制',
                    '@Transactional/@Async 常见坑：同类自调用导致代理不生效',
                ],
            },
            {
                'key': 'tx',
                'title': 'Spring 事务',
                'points': [
                    '传播行为、隔离级别、回滚规则（RuntimeException 默认回滚）',
                    '事务失效场景：异常被吃、非 public、手动 new、同类调用',
                ],
            },
            {
                'key': 'mvc',
                'title': 'Spring MVC 主流程',
                'points': [
                    'DispatcherServlet：HandlerMapping → Adapter → View/Response',
                    '过滤器 vs 拦截器 vs AOP：职责边界与调用时机',
                    '统一异常处理：@ControllerAdvice / @ExceptionHandler',
                ],
            },
            {
                'key': 'boot',
                'title': 'Spring Boot 自动装配',
                'points': [
                    '@SpringBootApplication、@EnableAutoConfiguration 的主线',
                    'Starter 与条件装配（@Conditional...）；配置优先级与覆盖',
                    'Actuator：健康检查与指标（上线必备）',
                ],
            },
        ],
    },
    '微服务': {
        'summary': '通信拆分 → 注册配置 → 治理可靠性 → 数据一致性 → 网关安全 → 可观测运维',
        'nodes': [
            {
                'key': 'split-comm',
                'title': '拆分与通信（RPC/REST）',
                'points': [
                    '拆分边界：按领域/按团队；避免“分布式单体”',
                    'RPC（Dubbo/gRPC）vs REST：超时、序列化、兼容性主线',
                    '超时与重试：默认禁止无脑重试，避免放大故障',
                ],
            },
            {
                'key': 'registry-config',
                'title': '注册发现与配置中心',
                'points': [
                    '注册中心：服务发现、健康检查；配置中心：动态配置与灰度',
                    '常见组件：Nacos/Eureka/ZooKeeper 的角色（理解即可）',
                ],
            },
            {
                'key': 'governance',
                'title': '流量治理与可靠性',
                'points': [
                    '限流/熔断/降级/隔离（线程池/舱壁）四件套',
                    '负载均衡、重试风暴治理、依赖超时传播',
                ],
            },
            {
                'key': 'consistency',
                'title': '数据一致性（分布式事务）',
                'points': [
                    '2PC/TCC/Saga/可靠消息最终一致：场景选择与代价',
                    '幂等与补偿：必须设计“可重放”的业务流程',
                ],
            },
            {
                'key': 'gateway-security',
                'title': '网关与安全',
                'points': [
                    'API Gateway：路由、鉴权、限流、统一跨域与日志',
                    '认证授权：JWT/OAuth2 的基本流程（知道即可）',
                ],
            },
            {
                'key': 'observability',
                'title': '可观测性与运维',
                'points': [
                    '三板斧：日志 + 指标 + 链路追踪；定位问题的顺序与打法',
                    '发布：灰度/滚动、回滚；容器化/K8s 的基本概念',
                ],
            },
        ],
    },
}


def get_quick_review_preset(category_name):
    """按分类名获取预设内容。"""
    return QUICK_REVIEW_PRESETS.get(category_name)

