import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PortalShell from '../../components/caregiver/PortalShell';
import Card, { SectionHeading } from '../../components/oneui/Card';
import Chip from '../../components/oneui/Chip';
import PillButton from '../../components/oneui/PillButton';
import Touchable from '../../components/oneui/Touchable';
import ListState from '../../components/oneui/ListState';
import TextField from '../../components/TextField';
import ResponseBanner, { failed, ok } from '../../components/ResponseBanner';
import useAsyncResource from '../../hooks/useAsyncResource';
import { profiles as profilesApi } from '../../api/endpoints';
import { colors, space, type } from '../../theme/tokens';
import { ACCESS_LABEL, ROLE_LABEL, useProfilePermissions } from './shared';

/*
 * Care profiles: everyone this account may read.
 *
 * The list is the service's answer to GET /profiles, which is scoped in the
 * database -- a family member's own profiles, a caregiver's current
 * assignments -- so there is no filtering here to get wrong. An empty list for
 * a caregiver means nobody has assigned them yet, and the empty state says so.
 *
 * ── Open by id ──
 *
 * In demo mode the screen also takes a pasted profile id and asks the service
 * for it. That is how a reviewer sees the hidden-record rule live: a profile
 * that exists but is not yours, and one that does not exist at all, come back
 * as the same 404 with the same sentence, so the answer cannot be used to find
 * out which ids are real.
 */
export default function CareProfilesScreen({ navigation, route }) {
  const { role, demo, canCreate } = useProfilePermissions(null);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await profilesApi.list();
      const count = data?.count ?? data?.profiles?.length ?? 0;
      setResult(ok(200, `${count} care profile${count === 1 ? '' : 's'} loaded.`));
      return data;
    } catch (err) {
      setResult(failed(err));
      throw err;
    }
  }, []);

  const { status, data, error, isRefreshing, reload } = useAsyncResource(load);

  // Back from creating or deleting a profile: reload, and show what the
  // screen that sent us here was told, rather than replacing it with "loaded".
  const notice = route?.params?.notice;
  useEffect(() => {
    if (!notice) return;
    navigation.setParams?.({ notice: undefined });
    reload({ quiet: true }).then(() => setResult(notice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  const list = data?.profiles || [];
  const count = data?.count ?? list.length;
  const roleLabel = ROLE_LABEL[role] || 'Signed in';

  return (
    <PortalShell
      navigation={navigation}
      active="CareProfiles"
      barTitle="Care Profiles"
      eyebrow={`${roleLabel.toUpperCase()} · ${count} PROFILE${count === 1 ? '' : 'S'}`}
      title="Care Profiles"
      subtitle={role === 'caregiver'
        ? 'The people you are assigned to care for'
        : 'The people in your care'}
      onRefresh={() => reload({ quiet: true })}
      refreshing={isRefreshing}
    >
      <View style={styles.sections}>
        <ResponseBanner result={result} quietSuccess />

        {canCreate ? (
          <PillButton
            label="New profile"
            icon="person-add"
            full
            onPress={() => navigation.navigate('NewCareProfile')}
            accessibilityHint="Register someone in your care"
          />
        ) : null}

        <ListState
          status={status}
          error={error}
          isEmpty={!list.length}
          onRetry={() => reload()}
          empty={{
            icon: 'people-outline',
            title: 'No care profiles',
            body: role === 'caregiver'
              ? 'No profiles are assigned to you yet.'
              : 'You have not added anyone yet. Create a profile for the person you care for.',
          }}
        >
          <View style={styles.list}>
            {list.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                onPress={() => navigation.navigate('CareProfileDetail', { id: profile.id })}
              />
            ))}
          </View>
        </ListState>

        {demo ? <OpenById navigation={navigation} onResult={setResult} /> : null}
      </View>
    </PortalShell>
  );
}

function ProfileRow({ profile, onPress }) {
  const access = ACCESS_LABEL[profile.accessVia] || 'Access';
  return (
    <Card
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${profile.fullName}. ${access}`}
      accessibilityHint="Opens the care profile"
    >
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Ionicons name="person" size={18} color={colors.teal} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name}>{profile.fullName}</Text>
          <Text style={styles.meta}>
            {profile.dateOfBirth ? `Born ${profile.dateOfBirth}` : 'Date of birth not recorded'}
          </Text>
        </View>
        <Chip
          compact
          tone={profile.accessVia === 'family_owner' ? 'active' : 'upcoming'}
          label={profile.accessVia === 'family_owner' ? 'Owner' : 'Read-only'}
        />
      </View>
    </Card>
  );
}

/** Demo tool: ask the service for any profile id, and show what it says. */
function OpenById({ navigation, onResult }) {
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(null);

  const open = async () => {
    const wanted = id.trim();
    if (!wanted || busy) return;
    setBusy(true);
    setOpened(null);
    try {
      const { profile } = await profilesApi.get(wanted);
      onResult(ok(200, `Opened ${profile.fullName} (${ACCESS_LABEL[profile.accessVia] || 'access granted'}).`));
      setOpened(profile);
    } catch (err) {
      onResult(failed(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SectionHeading>Open a profile by ID</SectionHeading>
      <Card style={styles.card}>
        <Text style={styles.meta}>
          Demo tool. Paste any profile id; the service decides whether you may see it.
        </Text>
        <TextField
          label="Profile ID"
          value={id}
          onChangeText={setId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="00000000-0000-0000-0000-000000000000"
          returnKeyType="go"
          onSubmitEditing={open}
        />
        <PillButton label="Open" icon="search" variant="tonal" onPress={open} loading={busy} disabled={!id.trim()} />
        {opened ? (
          <Touchable
            onPress={() => navigation.navigate('CareProfileDetail', { id: opened.id })}
            accessibilityRole="button"
            accessibilityLabel={`View ${opened.fullName}`}
          >
            <Text style={styles.link}>View {opened.fullName} →</Text>
          </Touchable>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl },
  list: { gap: space.md },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  name: { ...type.bodyMedium, color: colors.ink },
  meta: { ...type.caption, fontSize: 12, color: colors.inkMuted },
  link: { ...type.bodyMedium, color: colors.link, paddingVertical: space.sm },
});
