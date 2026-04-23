import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const LOGO_LIGHT = require('@/assets/images/logo-light.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle user login
  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
  }

  // Define colors based on the current color scheme
  const muted = scheme === 'dark' ? '#A8AFB4' : '#687076';
  const inputBackground = scheme === 'dark' ? '#1B1D1F' : '#F6F6F6';

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.content}>
        <View style={s.header}>
          <Image
            source={scheme === 'dark' ? LOGO_DARK : LOGO_LIGHT}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={[s.title, { color: colors.text }]}>Sign in</Text>
          <Text style={[s.subtitle, { color: muted }]}>Sign in to continue</Text>
        </View>

        <View style={s.form}>
          <TextInput
            style={[s.input, { backgroundColor: inputBackground, color: colors.text }]}
            placeholder="Email"
            placeholderTextColor={muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />
          <TextInput
            style={[s.input, { backgroundColor: inputBackground, color: colors.text }]}
            placeholder="Password"
            placeholderTextColor={muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <Pressable
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign in</Text>
            }
          </Pressable>

          <View style={s.demoHint}>
            <Text style={[s.demoHintLabel, { color: muted }]}>Demo account:</Text>
            <Text style={[s.demoHintText, { color: muted }]}>demo@habits.app</Text>
            <Text style={[s.demoHintText, { color: muted }]}>Password: demo</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={[s.footerText, { color: muted }]}>{"Don't have an account? "}</Text>
          <Pressable onPress={() => router.replace('/(auth)/register')}>
            <Text style={[s.footerLink, { color: colors.tint }]}>Create account</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 200,
    height: 44,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
  form: {
    gap: 12,
  },
  input: {
    height: 50,
    borderRadius: 6,
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
  demoHint: {
    marginTop: 8,
    alignItems: 'center',
  },
  demoHintLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  demoHintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700' },
});
