-- jargon Stage B+1.25 - computing foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 24 coding-domain terms for hardware and operating-system basics:
-- CPU, GPU, memory, buses, firmware, processor architecture, processes,
-- threads, kernels, filesystems, shells, daemons, and deadlocks.
--
-- Scope:
--   - terms rows only
--   - coding domain only
--   - no profile/rendering cache rewrites
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

('hw-cpu', 'CPU', 'C-P-U', 'systems', 'coding', 1,
 'The main processor that executes general-purpose instructions.',
 'CPU stands for central processing unit. It runs the ordinary instruction stream of a program: branching, arithmetic, function calls, OS work, and coordination with memory. A machine can have one CPU package with several cores inside it.',
 'The CPU was busy compiling TypeScript while the browser stayed responsive.',
 'CPU is the first hardware word behind performance talk. It explains why some work is limited by general computation instead of graphics, storage, or network speed.',
 ARRAY['hw-core','hw-clock-speed','hw-cache','os-process']::text[],
 ARRAY['code-algorithm']::text[],
 'hw-gpu',
 ARRAY[
   'A storage drive that keeps files after power is off',
   'A browser rule for cross-origin requests',
   'A network service that maps domains to IP addresses'
 ]::text[],
 'The ___ was busy compiling TypeScript while the browser stayed responsive.',
 'Use ''CPU'' in a sentence about general-purpose computer work.',
 'curated', 'curator', '2026-05-25'),

('hw-gpu', 'GPU', 'G-P-U', 'systems', 'coding', 1,
 'A processor designed to do many parallel math operations at once.',
 'GPU stands for graphics processing unit. It was built for graphics workloads, but the same parallel shape is useful for machine learning, image processing, simulations, and model inference. GPUs are fast when the same kind of math can run across many pieces of data at the same time.',
 'Training and running large AI models usually needs GPUs because the math is massively parallel.',
 'GPU is the hardware bridge between AI talk and computer architecture. It explains why model work often means special chips, memory limits, heat, cost, and cloud capacity.',
 ARRAY['hw-cpu','hw-core','hw-ram','ai-inference']::text[],
 ARRAY['hw-cpu']::text[],
 'hw-soc',
 ARRAY[
   'A version-control branch used for review',
   'A database rule that rejects invalid rows',
   'A text format used for API payloads'
 ]::text[],
 'Training and running large AI models usually needs ___s because the math is massively parallel.',
 'Use ''GPU'' in a sentence about parallel compute or AI workloads.',
 'curated', 'curator', '2026-05-25'),

('hw-core', 'core', null, 'systems', 'coding', 1,
 'One independent execution unit inside a CPU or GPU.',
 'A core is a processing unit that can work on instructions independently. More CPU cores let a computer run more work at the same time, assuming the software can split the work safely. A GPU has many smaller cores optimized for parallel math.',
 'The test runner used several CPU cores to run files in parallel.',
 'Core is the word behind "how many things can this chip do at once?" It connects hardware specs to build speed, model serving, and local development performance.',
 ARRAY['hw-cpu','hw-gpu','os-thread','hw-clock-speed']::text[],
 ARRAY['hw-cpu']::text[],
 'os-thread',
 ARRAY[
   'A permanent file stored on disk',
   'A URL path handled by a router',
   'A signed login token'
 ]::text[],
 'The test runner used several CPU ___s to run files in parallel.',
 'Use ''core'' in a sentence about a processor running work in parallel.',
 'curated', 'curator', '2026-05-25'),

('hw-clock-speed', 'clock speed', null, 'systems', 'coding', 1,
 'How many processor cycles a chip can attempt per second.',
 'Clock speed is usually shown in GHz. It is one ingredient in performance, but not the whole story: architecture, number of cores, cache, memory bandwidth, thermal limits, and the workload shape all matter too.',
 'A higher clock speed can help a single-threaded task finish faster.',
 'Clock speed is useful, but it is not a magic ranking of computers. Knowing the term helps you hear the difference between raw frequency and real workload performance.',
 ARRAY['hw-cpu','hw-core','hw-cache','os-thread']::text[],
 ARRAY['hw-cpu']::text[],
 'hw-cache',
 ARRAY[
   'The amount of persistent disk storage available',
   'The network delay before a response arrives',
   'The number of rows returned by a database query'
 ]::text[],
 'A higher ___ can help a single-threaded task finish faster.',
 'Use ''clock speed'' in a sentence about processor cycles.',
 'curated', 'curator', '2026-05-25'),

('hw-cache', 'CPU cache', null, 'systems', 'coding', 2,
 'Small fast memory near the processor used to avoid slower RAM reads.',
 'CPU cache stores recently used data close to the processor. It is much smaller than RAM but much faster. Code that repeatedly touches nearby data can be faster because the CPU can reuse cached values instead of waiting on main memory.',
 'The algorithm got faster when the hot data fit in CPU cache.',
 'Cache is a repeated idea across computing. CPU cache is the hardware version: save the nearby answer so the system does not keep doing slow work.',
 ARRAY['hw-cpu','hw-ram','sys-cache','math-complexity']::text[],
 ARRAY['hw-cpu','hw-ram']::text[],
 'sys-cache-invalidation',
 ARRAY[
   'A generated bundle written by a build',
   'A cloud URL that points at a deployment',
   'A database field used to link tables'
 ]::text[],
 'The algorithm got faster when the hot data fit in ___.',
 'Use ''CPU cache'' in a sentence about fast nearby processor memory.',
 'curated', 'curator', '2026-05-25'),

('hw-ram', 'RAM', 'ram', 'systems', 'coding', 1,
 'Fast temporary memory used by running programs.',
 'RAM stands for random-access memory. It holds the working data for programs while the computer is on: browser tabs, dev servers, build tools, editor state, and model processes. RAM is much faster than storage, but it is temporary.',
 'The local dev server and browser tabs used enough RAM to make the laptop swap.',
 'RAM explains why computers feel slow when too much is open. It is also a real limit for local models, databases, and big builds.',
 ARRAY['hw-cpu','hw-cache','hw-ssd','os-process']::text[],
 ARRAY['hw-cpu']::text[],
 'os-memory',
 ARRAY[
   'A permanent drive used to store files',
   'A network rule for browser requests',
   'A branch waiting for review'
 ]::text[],
 'The local dev server and browser tabs used enough ___ to make the laptop swap.',
 'Use ''RAM'' in a sentence about temporary working memory.',
 'curated', 'curator', '2026-05-25'),

('hw-ssd', 'SSD', 'S-S-D', 'systems', 'coding', 1,
 'Persistent flash storage that keeps files when power is off.',
 'SSD stands for solid-state drive. It stores the OS, apps, source code, databases, build artifacts, photos, and downloaded packages. Compared with older spinning disks, SSDs have much faster random access, which helps app launches, builds, and local database work.',
 'The repo checkout and node_modules folder live on the SSD.',
 'SSD is storage, not memory. Knowing the distinction helps you separate "the computer has room for files" from "the computer has enough RAM to run this workload."',
 ARRAY['hw-ram','os-filesystem','dev-node-modules','dev-build-artifact']::text[],
 ARRAY['os-filesystem']::text[],
 'hw-pcie',
 ARRAY[
   'Temporary working memory cleared when power turns off',
   'The protocol that encrypts web traffic',
   'A model setting that controls randomness'
 ]::text[],
 'The repo checkout and node_modules folder live on the ___.',
 'Use ''SSD'' in a sentence about persistent storage.',
 'curated', 'curator', '2026-05-25'),

('hw-bus', 'bus', null, 'systems', 'coding', 2,
 'A communication pathway that lets hardware components move data between each other.',
 'A hardware bus is how parts of a computer talk: CPU to memory, storage to chipset, expansion cards to motherboard. Different buses have different speed, latency, and physical constraints. PCIe is a common modern bus for high-speed components.',
 'The GPU sends data over the PCIe bus to communicate with the rest of the system.',
 'Bus is the word behind hardware plumbing. It explains why a fast chip can still be limited by how quickly data reaches it.',
 ARRAY['hw-pcie','hw-motherboard','hw-cpu','hw-gpu']::text[],
 ARRAY['hw-cpu','hw-motherboard']::text[],
 'hw-pcie',
 ARRAY[
   'A browser route that renders a screen',
   'A database transaction that rolls back writes',
   'A generated source map for debugging'
 ]::text[],
 'The GPU sends data over the PCIe ___ to communicate with the rest of the system.',
 'Use ''bus'' in a sentence about components moving data.',
 'curated', 'curator', '2026-05-25'),

('hw-pcie', 'PCIe', 'P-C-I-E', 'systems', 'coding', 2,
 'A high-speed connection standard for hardware components.',
 'PCIe stands for Peripheral Component Interconnect Express. It is the bus standard used by GPUs, high-speed SSDs, network cards, and other expansion devices. PCIe versions and lane counts determine how much data can move between the device and the rest of the computer.',
 'A GPU in a PCIe x16 slot has more bandwidth than the same card on fewer lanes.',
 'PCIe shows up whenever hardware people talk about expansion cards, bandwidth, or bottlenecks. It is a useful word for understanding why placement and lanes matter.',
 ARRAY['hw-bus','hw-gpu','hw-ssd','hw-motherboard']::text[],
 ARRAY['hw-bus']::text[],
 'hw-motherboard',
 ARRAY[
   'A text protocol for API responses',
   'A passwordless login email',
   'A model architecture based on attention'
 ]::text[],
 'A GPU in a ___ x16 slot has more bandwidth than the same card on fewer lanes.',
 'Use ''PCIe'' in a sentence about a high-speed hardware connection.',
 'curated', 'curator', '2026-05-25'),

('hw-motherboard', 'motherboard', null, 'systems', 'coding', 1,
 'The main circuit board that connects the computer components.',
 'The motherboard holds or connects the CPU, RAM slots, storage connectors, PCIe slots, firmware chip, power delivery, and ports. It defines what components fit together and which features the system can support.',
 'The motherboard determines which CPU socket, RAM type, and PCIe slots the machine can use.',
 'Motherboard is the physical map of a computer. Knowing it helps you understand compatibility, expansion, and why parts cannot always be mixed freely.',
 ARRAY['hw-cpu','hw-ram','hw-pcie','hw-firmware']::text[],
 ARRAY['hw-cpu','hw-ram']::text[],
 'hw-bios-uefi',
 ARRAY[
   'The OS service that schedules processes',
   'A database table that stores rows',
   'A network tunnel for private traffic'
 ]::text[],
 'The ___ determines which CPU socket, RAM type, and PCIe slots the machine can use.',
 'Use ''motherboard'' in a sentence about the main board connecting computer parts.',
 'curated', 'curator', '2026-05-25'),

('hw-firmware', 'firmware', null, 'systems', 'coding', 2,
 'Low-level software stored on a device that controls the hardware itself.',
 'Firmware lives closer to hardware than normal app software. It can initialize a motherboard, run a keyboard controller, manage a router, or update a device. Firmware updates can fix bugs or security issues, but bad firmware can make hardware fail to boot.',
 'The router needed a firmware update before the network stopped dropping packets.',
 'Firmware is why hardware still has software behavior. It is the layer that makes devices configurable, patchable, and sometimes fragile.',
 ARRAY['hw-bios-uefi','hw-motherboard','os-kernel','sec-vulnerability']::text[],
 ARRAY['hw-motherboard']::text[],
 'hw-bios-uefi',
 ARRAY[
   'A React component that renders UI',
   'A branch created for a pull request',
   'A JSON field returned by an API'
 ]::text[],
 'The router needed a ___ update before the network stopped dropping packets.',
 'Use ''firmware'' in a sentence about software stored on hardware devices.',
 'curated', 'curator', '2026-05-25'),

('hw-bios-uefi', 'BIOS/UEFI', 'BYE-oss / U-E-F-I', 'systems', 'coding', 2,
 'Startup firmware that initializes hardware before the OS loads.',
 'BIOS and UEFI are firmware interfaces involved at boot. They initialize hardware, expose settings, choose boot devices, and hand control to the OS loader. UEFI is the modern replacement for legacy BIOS, but people often say BIOS casually for the firmware setup screen.',
 'Change the boot order in BIOS/UEFI so the machine starts from the installer drive.',
 'BIOS/UEFI explains what happens before the OS exists. It is the right layer for boot order, secure boot, firmware settings, and some hardware-level failures.',
 ARRAY['hw-firmware','hw-motherboard','os-kernel','os-filesystem']::text[],
 ARRAY['hw-firmware']::text[],
 'os-kernel',
 ARRAY[
   'A package manager lockfile',
   'A database key that links rows',
   'A browser cache rule'
 ]::text[],
 'Change the boot order in ___ so the machine starts from the installer drive.',
 'Use ''BIOS/UEFI'' in a sentence about boot firmware.',
 'curated', 'curator', '2026-05-25'),

('hw-instruction-set', 'instruction set', null, 'systems', 'coding', 2,
 'The operations a processor architecture knows how to execute.',
 'An instruction set is the vocabulary of machine instructions a CPU understands: load, store, add, branch, compare, vector operations, and more. Software has to be compiled for the instruction set it will run on. ARM and x86 are major instruction-set families.',
 'The binary failed because it was built for the wrong instruction set.',
 'Instruction set connects software to silicon. It explains why the same source code may need different builds for Apple silicon, Intel Macs, phones, and servers.',
 ARRAY['hw-cpu','hw-arm','dev-build-artifact','os-kernel']::text[],
 ARRAY['hw-cpu']::text[],
 'hw-arm',
 ARRAY[
   'A list of API endpoints exposed by a server',
   'A set of tests that measure model quality',
   'A database schema for app records'
 ]::text[],
 'The binary failed because it was built for the wrong ___.',
 'Use ''instruction set'' in a sentence about what a processor can run.',
 'curated', 'curator', '2026-05-25'),

('hw-arm', 'ARM', 'arm', 'systems', 'coding', 1,
 'A processor architecture used in phones, tablets, servers, and modern Macs.',
 'ARM is an instruction-set architecture. Apple silicon Macs, iPhones, many Android phones, and some cloud servers use ARM-based chips. ARM chips are often designed for strong performance per watt, which is why they show up in mobile and battery-sensitive devices.',
 'The package needed an ARM build to run natively on the Apple silicon Mac.',
 'ARM explains why "works on my Intel machine" is not always enough. Architecture affects binaries, Docker images, native modules, performance, and compatibility.',
 ARRAY['hw-instruction-set','hw-soc','dev-build-artifact','dev-node-modules']::text[],
 ARRAY['hw-instruction-set']::text[],
 'hw-soc',
 ARRAY[
   'A browser rule for allowed origins',
   'A database index for faster queries',
   'A model prompt with several examples'
 ]::text[],
 'The package needed an ___ build to run natively on the Apple silicon Mac.',
 'Use ''ARM'' in a sentence about processor architecture.',
 'curated', 'curator', '2026-05-25'),

('hw-soc', 'system on a chip (SoC)', 'S-O-C', 'systems', 'coding', 2,
 'A chip that combines CPU, GPU, memory controllers, and other hardware blocks.',
 'A system on a chip puts many computer subsystems onto one piece of silicon. Phones and Apple silicon Macs use SoCs so the CPU, GPU, neural engine, media engines, security hardware, and memory controllers can work closely together with less power and latency.',
 'Apple silicon is an SoC, not just a standalone CPU.',
 'SoC is the word behind modern device integration. It explains why newer machines can feel fast, efficient, and less modular at the same time.',
 ARRAY['hw-cpu','hw-gpu','hw-arm','hw-ram']::text[],
 ARRAY['hw-cpu','hw-gpu','hw-arm']::text[],
 'hw-instruction-set',
 ARRAY[
   'A cloud function that runs without a server',
   'A database transaction that updates rows',
   'A protocol for encrypting web requests'
 ]::text[],
 'Apple silicon is an ___, not just a standalone CPU.',
 'Use ''SoC'' in a sentence about a chip that combines many hardware subsystems.',
 'curated', 'curator', '2026-05-25'),

('os-process', 'process', null, 'systems', 'coding', 1,
 'A running instance of a program managed by the OS.',
 'A process has its own memory, open files, environment, permissions, and execution state. When you start a dev server, browser, database, or test runner, the OS creates one or more processes to run that work.',
 'The Vite dev server was still listening because the old node process was running.',
 'Process is the practical unit behind local development. It explains ports staying busy, background work, CPU usage, crashes, and what task managers actually show.',
 ARRAY['os-thread','os-kernel','os-environment-variable','flow-port']::text[],
 ARRAY['os-kernel']::text[],
 'os-thread',
 ARRAY[
   'A stored row in a database table',
   'A file path handled by a router',
   'A GPU slot on the motherboard'
 ]::text[],
 'The Vite dev server was still listening because the old node ___ was running.',
 'Use ''process'' in a sentence about a running program.',
 'curated', 'curator', '2026-05-25'),

('os-thread', 'thread', null, 'systems', 'coding', 2,
 'A path of execution inside a process.',
 'A thread lets one process run multiple paths of work. Threads share the process memory, which makes communication fast but also creates coordination problems. Bugs like deadlocks and race conditions often come from threads or async work touching shared state in the wrong order.',
 'The renderer stayed responsive because the expensive work moved off the main thread.',
 'Thread is the word behind concurrency inside a program. It helps you separate "one app" from "one stream of work."',
 ARRAY['os-process','hw-core','sys-race-condition','os-deadlock']::text[],
 ARRAY['os-process']::text[],
 'os-deadlock',
 ARRAY[
   'A package installed by npm',
   'A persistent file saved on an SSD',
   'A signed token sent with a request'
 ]::text[],
 'The renderer stayed responsive because the expensive work moved off the main ___.',
 'Use ''thread'' in a sentence about one execution path inside a process.',
 'curated', 'curator', '2026-05-25'),

('os-kernel', 'kernel', null, 'systems', 'coding', 2,
 'The core OS layer that manages hardware, memory, files, and processes.',
 'The kernel sits between programs and hardware. It schedules processes, manages memory, controls filesystem access, exposes networking, and handles system calls. Apps do not usually talk directly to hardware; they ask the kernel to do privileged work.',
 'The kernel killed the process after it used too much memory.',
 'Kernel is the center of OS talk. It explains why permissions, crashes, drivers, files, memory, and processes are connected under one lower-level layer.',
 ARRAY['os-system-call','os-process','os-filesystem','hw-firmware']::text[],
 ARRAY['os-process']::text[],
 'os-system-call',
 ARRAY[
   'A reusable React UI piece',
   'A cloud URL for a preview branch',
   'A model setting for randomness'
 ]::text[],
 'The ___ killed the process after it used too much memory.',
 'Use ''kernel'' in a sentence about the OS layer managing hardware and processes.',
 'curated', 'curator', '2026-05-25'),

('os-system-call', 'system call', null, 'systems', 'coding', 2,
 'A request from a program to the kernel for OS-level work.',
 'A system call is how user-space code asks the kernel to do protected work: read a file, open a socket, allocate memory, start a process, or write to a device. Languages and libraries wrap system calls so app code rarely invokes them directly.',
 'Opening a file eventually becomes a system call to the OS kernel.',
 'System call is the bridge from code into the OS. It makes "software talks to hardware" less magical and more layered.',
 ARRAY['os-kernel','os-filesystem','net-socket','os-process']::text[],
 ARRAY['os-kernel']::text[],
 'os-permission',
 ARRAY[
   'A function exported by a React component',
   'A row-level security policy in Postgres',
   'A DNS record for a domain'
 ]::text[],
 'Opening a file eventually becomes a ___ to the OS kernel.',
 'Use ''system call'' in a sentence about a program asking the kernel for work.',
 'curated', 'curator', '2026-05-25'),

('os-filesystem', 'filesystem', null, 'systems', 'coding', 1,
 'The OS structure that stores and organizes files and folders.',
 'A filesystem defines how files are named, stored, found, permissioned, and updated on storage. Paths, folders, file extensions, read/write permissions, and disk free-space errors all live in this layer.',
 'The build failed because the filesystem path pointed at a file that did not exist.',
 'Filesystem is the literal ground under a repo. It explains paths, generated files, permissions, missing assets, and why a command may work from one folder but fail from another.',
 ARRAY['os-path','hw-ssd','os-permission','dev-build-artifact']::text[],
 ARRAY['hw-ssd']::text[],
 'os-system-call',
 ARRAY[
   'A processor core that runs instructions',
   'A browser session after login',
   'A model benchmark score'
 ]::text[],
 'The build failed because the ___ path pointed at a file that did not exist.',
 'Use ''filesystem'' in a sentence about storing and finding files.',
 'curated', 'curator', '2026-05-25'),

('os-shell', 'shell', null, 'systems', 'coding', 1,
 'A command interpreter that runs terminal commands.',
 'The shell reads commands like git status, npm run test, cd, rg, and kill, then starts programs or changes shell state. zsh, bash, and fish are shells. The terminal is the window; the shell is the command language running inside it.',
 'The shell expanded the wildcard before the command ran.',
 'Shell is the everyday interface between you and development tools. It explains why quoting, paths, environment variables, and command history matter.',
 ARRAY['os-environment-variable','os-process','git-cli','dev-script']::text[],
 ARRAY['os-process']::text[],
 'os-system-call',
 ARRAY[
   'A browser route rendered by React',
   'A database table that stores rows',
   'A GPU memory cache'
 ]::text[],
 'The ___ expanded the wildcard before the command ran.',
 'Use ''shell'' in a sentence about running terminal commands.',
 'curated', 'curator', '2026-05-25'),

('os-environment-variable', 'environment variable', null, 'systems', 'coding', 1,
 'A named runtime value supplied outside the source code.',
 'An environment variable lets a process read configuration from its environment: API URLs, feature flags, mode names, and secret references. Sensitive values should not be printed or committed. Local, preview, and production environments can have different values.',
 'The Edge Function reads the API base URL from an environment variable.',
 'Environment variable explains how the same code behaves differently in local, preview, and production without hardcoding those differences into the repo.',
 ARRAY['os-process','os-shell','sec-secret','cloud-environment']::text[],
 ARRAY['os-process']::text[],
 'sec-secret',
 ARRAY[
   'A saved browser cookie sent with a request',
   'A generated bundle produced by a build',
   'A database row that stores one record'
 ]::text[],
 'The Edge Function reads the API base URL from an ___.',
 'Use ''environment variable'' in a sentence about runtime configuration outside code.',
 'curated', 'curator', '2026-05-25'),

('os-daemon', 'daemon', 'DEE-mun', 'systems', 'coding', 2,
 'A background process that runs without a normal interactive window.',
 'A daemon is a long-running background process managed by the OS or a service manager. It might listen for network requests, watch files, sync data, run scheduled work, or keep a local service alive. On macOS, launchd manages many daemon-like services.',
 'The database daemon kept running after the terminal window closed.',
 'Daemon is the word behind "something is still running." It helps you debug local ports, background services, sync agents, and machine startup behavior.',
 ARRAY['os-process','cloud-service','flow-port','os-shell']::text[],
 ARRAY['os-process']::text[],
 'cloud-cron',
 ARRAY[
   'A database constraint that rejects bad rows',
   'A CSS rule that changes spacing',
   'A prompt example shown to a model'
 ]::text[],
 'The database ___ kept running after the terminal window closed.',
 'Use ''daemon'' in a sentence about a background process.',
 'curated', 'curator', '2026-05-25'),

('os-deadlock', 'deadlock', null, 'systems', 'coding', 2,
 'A state where two or more tasks wait on each other forever.',
 'A deadlock happens when work cannot continue because each participant is holding something the other needs. In software this often means locks: thread A holds lock 1 and waits for lock 2, while thread B holds lock 2 and waits for lock 1.',
 'The two workers hit a deadlock because each waited for the other lock first.',
 'Deadlock is a precise word for a system stuck by circular waiting. It is different from slowness, a crash, or a timeout, and the fix is usually about ordering and ownership.',
 ARRAY['os-thread','sys-race-condition','sys-timeout','sys-transaction']::text[],
 ARRAY['os-thread']::text[],
 'sys-race-condition',
 ARRAY[
   'A browser redirect after sign-in',
   'A source map for minified code',
   'A model answer with no grounding'
 ]::text[],
 'The two workers hit a ___ because each waited for the other lock first.',
 'Use ''deadlock'' in a sentence about tasks waiting on each other forever.',
 'curated', 'curator', '2026-05-25')

on conflict (id) do nothing;
