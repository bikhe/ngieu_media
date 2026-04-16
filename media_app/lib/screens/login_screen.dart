import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool isLogin = true;
  final userCtrl = TextEditingController();
  final passCtrl = TextEditingController();
  final inviteCtrl = TextEditingController();
  bool isLoading = false;

  void _submit() async {
    if (userCtrl.text.isEmpty || passCtrl.text.isEmpty) return;
    setState(() => isLoading = true);

    bool success;
    if (isLogin) {
      success = await ApiService.login(userCtrl.text, passCtrl.text);
    } else {
      success = await ApiService.register(
        userCtrl.text,
        passCtrl.text,
        inviteCtrl.text,
      );
      if (success) {
        success = await ApiService.login(
          userCtrl.text,
          passCtrl.text,
        ); // Автологин после реги
      }
    }

    setState(() => isLoading = false);

    if (success && mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ошибка! Проверьте данные.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.camera_alt_outlined,
                size: 80,
                color: Colors.blue,
              ),
              const SizedBox(height: 16),
              const Text(
                'СМИ НГИЭУ',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 32),

              TextField(
                controller: userCtrl,
                decoration: const InputDecoration(
                  labelText: 'Логин',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Пароль',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),

              if (!isLogin)
                TextField(
                  controller: inviteCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Инвайт-код (от админа)',
                    border: OutlineInputBorder(),
                  ),
                ),

              const SizedBox(height: 24),
              FilledButton(
                onPressed: isLoading ? null : _submit,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text(isLogin ? 'ВОЙТИ' : 'ЗАРЕГИСТРИРОВАТЬСЯ'),
              ),
              TextButton(
                onPressed: () => setState(() => isLogin = !isLogin),
                child: Text(
                  isLogin
                      ? 'Нет аккаунта? Нужен код!'
                      : 'Уже есть аккаунт? Войти',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
