import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  List _events = [], _equipmentList = [];
  Map _me = {};
  bool _isLoading = true;
  late TabController _tabController;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
    // Short polling: обновляем ленту каждые 10 секунд
    _pollingTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _loadData(showLoading: false),
    );
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData({bool showLoading = true}) async {
    if (showLoading && mounted) setState(() => _isLoading = true);
    try {
      final me = await ApiService.getUserMe();
      final events = await ApiService.getEvents();
      if (me['features']?['equipment_booking'] == true &&
          _equipmentList.isEmpty) {
        _equipmentList = await ApiService.getEquipment();
      }
      if (mounted) {
        setState(() {
          _me = me;
          _events = events;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showProfileDialog() async {
    final fName = TextEditingController(text: _me['first_name'] ?? '');
    final lName = TextEditingController(text: _me['last_name'] ?? '');
    final tg = TextEditingController(text: _me['telegram_id'] ?? '');

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Мой профиль'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: fName,
              decoration: const InputDecoration(labelText: 'Имя'),
            ),
            TextField(
              controller: lName,
              decoration: const InputDecoration(labelText: 'Фамилия'),
            ),
            TextField(
              controller: tg,
              decoration: const InputDecoration(
                labelText: 'Telegram ID (для бота)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Отмена'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ApiService.updateProfile(fName.text, lName.text, tg.text);
              _loadData();
            },
            child: const Text('Сохранить'),
          ),
        ],
      ),
    );
  }

  // Модалка для выбора техники перед взятием заявки
  Future<void> _takeTaskWithEquipment(int eventId) async {
    if (_me['features']?['equipment_booking'] != true ||
        _equipmentList.isEmpty) {
      await ApiService.takeTask(eventId, []);
      _loadData();
      return;
    }

    List<int> selectedEq = [];
    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Взять технику?'),
            content: SizedBox(
              width: double.maxFinite,
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _equipmentList.length,
                itemBuilder: (c, i) {
                  final eq = _equipmentList[i];
                  return CheckboxListTile(
                    title: Text(eq['name']),
                    value: selectedEq.contains(eq['id']),
                    onChanged: (val) {
                      setDialogState(() {
                        if (val == true)
                          selectedEq.add(eq['id']);
                        else
                          selectedEq.remove(eq['id']);
                      });
                    },
                  );
                },
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Отмена'),
              ),
              FilledButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await ApiService.takeTask(eventId, selectedEq);
                  _loadData();
                },
                child: const Text('Записаться'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _submitWork(int eventId) async {
    final linkCtrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Сдача работы'),
        content: TextField(
          controller: linkCtrl,
          decoration: const InputDecoration(labelText: 'Ссылка на диск/облако'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Отмена'),
          ),
          FilledButton(
            onPressed: () async {
              if (linkCtrl.text.isEmpty) return;
              Navigator.pop(ctx);
              await ApiService.submitWork(eventId, linkCtrl.text);
              _loadData();
            },
            child: const Text('Отправить'),
          ),
        ],
      ),
    );
  }

  void _openChatSheet(int eventId) async {
    final msgCtrl = TextEditingController();
    List comments = await ApiService.getComments(eventId);
    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: SizedBox(
                height: MediaQuery.of(context).size.height * 0.6,
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      child: const Text(
                        'Чат мероприятия',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: comments.length,
                        itemBuilder: (c, i) {
                          final m = comments[i];
                          final isMe =
                              m['author']?['username'] == _me['username'];
                          String aName =
                              m['author']?['first_name'] != null &&
                                  m['author']['first_name'] != ''
                              ? '${m['author']['first_name']} ${m['author']['last_name'] ?? ''}'
                                    .trim()
                              : (m['author']?['username'] ?? 'User');

                          return Align(
                            alignment: isMe
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isMe
                                    ? Theme.of(
                                        context,
                                      ).colorScheme.primaryContainer
                                    : Theme.of(
                                        context,
                                      ).colorScheme.surfaceVariant,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (!isMe)
                                    Text(
                                      aName,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                        color: Theme.of(
                                          context,
                                        ).colorScheme.primary,
                                      ),
                                    ),
                                  Text(m['text']),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: msgCtrl,
                              decoration: const InputDecoration(
                                hintText: 'Сообщение...',
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.all(
                                    Radius.circular(24),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          CircleAvatar(
                            backgroundColor: Theme.of(
                              context,
                            ).colorScheme.primary,
                            child: IconButton(
                              icon: const Icon(Icons.send, color: Colors.white),
                              onPressed: () async {
                                if (msgCtrl.text.isEmpty) return;
                                await ApiService.postComment(
                                  eventId,
                                  msgCtrl.text,
                                );
                                msgCtrl.clear();
                                comments = await ApiService.getComments(
                                  eventId,
                                );
                                setSheetState(() {});
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildEventCard(Map e, bool isMyTask) {
    final mySkill = _me['skill_level'] ?? 'ANY';
    final hasAccess =
        _me['features']?['skill_levels'] != true ||
        e['required_skill'] == 'ANY' ||
        mySkill == 'PRO' ||
        mySkill == e['required_skill'];
    final isFull =
        (e['media_participants']?.length ?? 0) >= (e['max_participants'] ?? 1);

    String orgName =
        e['responsible_person']?['first_name'] != null &&
            e['responsible_person']['first_name'] != ''
        ? '${e['responsible_person']['first_name']} ${e['responsible_person']['last_name'] ?? ''}'
              .trim()
        : (e['responsible_person']?['username'] ?? 'Неизвестно');

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Chip(
                  label: Text(
                    e['status'],
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
                if (!hasAccess && !isMyTask)
                  const Chip(
                    label: Text('Нужен VIP', style: TextStyle(fontSize: 12)),
                    avatar: Icon(Icons.lock, size: 14),
                  ),
                if (hasAccess && !isMyTask)
                  Chip(
                    label: Text(
                      '${e['media_participants']?.length ?? 0} / ${e['max_participants']}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              e['title'],
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.calendar_today, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  DateFormat('dd.MM.yyyy').format(DateTime.parse(e['date'])),
                  style: const TextStyle(color: Colors.grey),
                ),
                const SizedBox(width: 12),
                const Icon(Icons.location_on, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    e['location'] ?? '',
                    style: const TextStyle(color: Colors.grey),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Орг: $orgName',
              style: const TextStyle(fontSize: 13, color: Colors.grey),
            ),

            const Divider(height: 24),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    if (e['document_link'] != null &&
                        e['document_link'].isNotEmpty)
                      IconButton(
                        icon: const Icon(Icons.description, color: Colors.blue),
                        onPressed: () =>
                            launchUrl(Uri.parse(e['document_link'])),
                      ),
                    if (_me['features']?['event_chat'] == true)
                      IconButton(
                        icon: const Icon(Icons.chat_bubble_outline),
                        onPressed: () => _openChatSheet(e['id']),
                      ),
                  ],
                ),

                if (!isMyTask && hasAccess && !isFull)
                  FilledButton(
                    onPressed: () => _takeTaskWithEquipment(e['id']),
                    child: const Text('Я пойду'),
                  ),

                if (isMyTask && e['status'] == 'IN_PROGRESS')
                  FilledButton.tonal(
                    onPressed: () => _submitWork(e['id']),
                    child: const Text('Сдать работу'),
                  ),

                if (isMyTask && e['status'] == 'COMPLETED')
                  const Chip(
                    label: Text('Сдано', style: TextStyle(color: Colors.green)),
                    backgroundColor: Colors.transparent,
                    side: BorderSide(color: Colors.green),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));

    // Фильтруем заявки
    final myEvents = _events
        .where(
          (e) => (e['media_participants'] as List).any(
            (p) => p['id'] == _me['id'] || p['username'] == _me['username'],
          ),
        )
        .toList();
    final openEvents = _events
        .where(
          (e) =>
              e['status'] == 'OPEN' && !myEvents.any((m) => m['id'] == e['id']),
        )
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'СМИ НГИЭУ',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: _showProfileDialog,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ApiService.logout();
              if (mounted)
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Свободные'),
            Tab(text: 'Мои задачи'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          RefreshIndicator(
            onRefresh: () => _loadData(),
            child: ListView(
              padding: const EdgeInsets.only(top: 8, bottom: 24),
              children: openEvents.isEmpty
                  ? [
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Text('Нет свободных заявок'),
                        ),
                      ),
                    ]
                  : openEvents.map((e) => _buildEventCard(e, false)).toList(),
            ),
          ),
          RefreshIndicator(
            onRefresh: () => _loadData(),
            child: ListView(
              padding: const EdgeInsets.only(top: 8, bottom: 24),
              children: myEvents.isEmpty
                  ? [
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Text('Вы еще не взяли задач'),
                        ),
                      ),
                    ]
                  : myEvents.map((e) => _buildEventCard(e, true)).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
