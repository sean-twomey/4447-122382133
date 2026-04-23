import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const LOGO_LIGHT = require('@/assets/images/logo-light.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');

export default function RegisterScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { register } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle user registration
  async function handleRegister() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const result = await register(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
    // Navigation happens automatically via the redirect in _layout.tsx
  }

  const isDark = scheme === 'dark';
  const inputBg = isDark ? '#1E1E1E' : '#F4F4F4';
  const inputBorder = isDark ? '#333' : '#E0E0E0';
  const muted = isDark ? '#9A9590' : '#6B6560';

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.inner}>
        {/* Header */}
        <View style={s.header}>
          <Image
            source={isDark ? LOGO_DARK : LOGO_LIGHT}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={[s.title, { color: colors.text }]}>Create account</Text>
          <Text style={[s.subtitle, { color: muted }]}>Create an account to save your habits.</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <TextInput
            style={[s.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
            placeholder="Email"
            placeholderTextColor={muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />
          <TextInput
            style={[s.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
            placeholder="Password (min. 6 characters)"
            placeholderTextColor={muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="next"
          />
          <TextInput
            style={[s.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
            placeholder="Confirm password"
            placeholderTextColor={muted}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            returnKeyType="go"
            onSubmitEditing={handleRegister}
          />

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <Pressable
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Create account</Text>
            }
          </Pressable>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={[s.footerText, { color: muted }]}>Already have an account? </Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={[s.footerLink, { color: colors.tint }]}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  header: { marginBottom: 40, alignItems: 'center' },
  logo: {
    width: 220,
    height: 48,
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 15 },
  form: { gap: 14 },
  input: {
    height: 52,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#C0392B',
    fontSize: 14,
    textAlign: 'center',
  },
  btn: {
    height: 52,
    borderRadius: 6,
    backgroundColor: '#0A6B7D',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  footerText: { fontSize: 15 },
  footerLink: { fontSize: 15, fontWeight: '700' },
});
