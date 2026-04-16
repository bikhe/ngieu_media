import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:8000/api/';

  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access');
    return {
      'Content-Type': 'application/json; charset=UTF-8',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<bool> login(String username, String password) async {
    try {
      final res = await http.post(
        Uri.parse('${baseUrl}token/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access', data['access']);
        await prefs.setString('refresh', data['refresh']);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> register(
    String username,
    String password,
    String inviteCode,
  ) async {
    try {
      final res = await http.post(
        Uri.parse('${baseUrl}register/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'password': password,
          'invite_code': inviteCode,
        }),
      );
      return res.statusCode == 200 || res.statusCode == 201;
    } catch (e) {
      return false;
    }
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  static Future<Map<String, dynamic>> getUserMe() async {
    final res = await http.get(
      Uri.parse('${baseUrl}users/me/'),
      headers: await _getHeaders(),
    );
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  static Future<bool> updateProfile(
    String fName,
    String lName,
    String tgId,
  ) async {
    final res = await http.post(
      Uri.parse('${baseUrl}users/me/'),
      headers: await _getHeaders(),
      body: jsonEncode({
        'first_name': fName,
        'last_name': lName,
        'telegram_id': tgId,
      }),
    );
    return res.statusCode == 200;
  }

  static Future<List> getEvents() async {
    final res = await http.get(
      Uri.parse('${baseUrl}events/'),
      headers: await _getHeaders(),
    );
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  static Future<List> getEquipment() async {
    final res = await http.get(
      Uri.parse('${baseUrl}equipment/'),
      headers: await _getHeaders(),
    );
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  static Future<bool> takeTask(int eventId, List<int> equipmentIds) async {
    final res = await http.post(
      Uri.parse('${baseUrl}events/$eventId/take_task/'),
      headers: await _getHeaders(),
      body: jsonEncode({'equipment_ids': equipmentIds}),
    );
    return res.statusCode == 200;
  }

  static Future<bool> submitWork(int eventId, String link) async {
    final res = await http.post(
      Uri.parse('${baseUrl}events/$eventId/submit_work/'),
      headers: await _getHeaders(),
      body: jsonEncode({'result_link': link}),
    );
    return res.statusCode == 200;
  }

  static Future<List> getComments(int eventId) async {
    final res = await http.get(
      Uri.parse('${baseUrl}events/$eventId/comments/'),
      headers: await _getHeaders(),
    );
    if (res.statusCode == 200) return jsonDecode(utf8.decode(res.bodyBytes));
    return [];
  }

  static Future<bool> postComment(int eventId, String text) async {
    final res = await http.post(
      Uri.parse('${baseUrl}events/$eventId/comments/'),
      headers: await _getHeaders(),
      body: jsonEncode({'text': text}),
    );
    return res.statusCode == 201;
  }
}
