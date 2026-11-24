import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PortalShell from '../../components/caregiver/PortalShell';
import Card, { Divider, SectionHeading } from '../../components/oneui/Card';
import Chip from '../../components/oneui/Chip';
import PillButton from '../../components/oneui/PillButton';
import { ListSkeleton } from '../../components/oneui/ListState';
import TextField from '../../components/TextField';
import ResponseBanner, { failed, ok } from '../../components/ResponseBanner';
import useAsyncResource from '../../hooks/useAsyncResource';
import { profiles as profilesApi } from '../../api/endpoints';
import { colors, space, type } from '../../theme/tokens';
import { fieldErrors } from './shared';

/*
 * The care team: which caregivers can read this profile, and since when.
 *
 * Only the family member who owns the profile may see or change it. Anyone
 * else who reaches this screen (a caregiver in demo mode) gets the service's
 * refusal in the banner, and the assign form stays, so the refusal of an
 * assignment can be shown as well as the refusal to list.
 *
 * Assigning takes the caregiver's phone number, and the service accepts only
 * an active, verified caregiver account: an unverified one is refused with
 * CAREGIVER_NOT_FOUND, because assignment is what turns a role into access to
 * one person's health record.
 *
 * Ending an assignment keeps the row, dated, on the service: it is the record
 * of who could read this profile when. It is confirmed in place, for the same
 * reason Delete is (no Alert.alert buttons on the web).
 */
export default function CareTeamScreen({ navigation, route }) {
  const id = route?.params?.id;
  const name = route?.params?.name;
  const [result, setResult] = useState(null);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const [busy, setBusy] = useState(null); // 'assign' | assignment id
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await profilesApi.listAssignments(id);
      const active = (data.assignments || []).filter((a) => a.status === 'active').length;
      setResult(ok(200, `${active} caregiver${active === 1 ? '' : 's'} on the care team.`));
      return data;
    } catch (err) {
      setResult(failed(err));
      throw err;
    }
  }, [id]);

  const { status, data, reload } = useAsyncResource(load, [id]);
  const assignments = data?.assignments || [];
  const current = assignments.filter((a) => a.status === 'active');
  const past = assignments.filter((a) => a.status !== 'active');

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('CareProfiles'));

  const assign = async () => {
    if (busy) return;
    setBusy('assign');
    setPhoneError(null);
    try {
      const { assignment } = await profilesApi.assign(id, { caregiverPhone: phone.trim() });
      setPhone('');
      await reload({ quiet: true });
      setResult(ok(201, `${assignment.caregiver.fullName} can now read this profile.`));
    } catch (err) {
      setPhoneError(fieldErrors(err).caregiverPhone || null);
      setResult(failed(err));
    } finally {
      setBusy(null);
    }
  };

  const end = async (assignment) => {
    if (busy) return;
    setBusy(assignment.id);
    try {
      const res = await profilesApi.endAssignment(id, assignment.id);
      setConfirming(null);
      await reload({ quiet: true });
      setResult(ok(200, res?.message || 'Access ended.'));
    } catch (err) {
      setResult(failed(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PortalShell
      navigation={navigation}
      active="CareProfiles"
      barTitle="Care team"
      title="Care team"
      subtitle={name ? `Who can read ${name}'s profile` : 'Who can read this profile'}
      onBack={back}
    >
      <View style={styles.sections}>
        <ResponseBanner result={result} quietSuccess />

        <View>
          <SectionHeading>Current Caregivers</SectionHeading>
          {status === 'loading' ? <ListSkeleton rows={2} height={72} /> : (
            <Card style={styles.card}>
              {status === 'error' && !data ? (
                <Text style={styles.muted}>The care team could not be shown.</Text>
              ) : current.length ? current.map((a, i) => (
                <View key={a.id} style={styles.member}>
                  {i > 0 ? <Divider inset={0} /> : null}
                  <View style={styles.memberRow}>
                    <View style={styles.memberText}>
                      <Text style={styles.name}>{a.caregiver.fullName}</Text>
                      <Text style={styles.muted}>
                        {a.caregiver.phoneNumber} · since {a.startDate || '—'}
                      </Text>
                    </View>
                    {confirming === a.id ? null : (
                      <PillButton
                        label="End"
                        size="sm"
                        variant="danger"
                        onPress={() => setConfirming(a.id)}
                        accessibilityHint={`Ends ${a.caregiver.fullName}'s access to this profile`}
                      />
                    )}
                  </View>
                  {confirming === a.id ? (
                    <View style={styles.confirm} accessibilityRole="alert">
                      <Text style={styles.confirmText}>
                        End {a.caregiver.fullName}'s access? They will no longer see this profile.
                      </Text>
                      <View style={styles.actions}>
                        <PillButton label="Cancel" variant="quiet" size="sm" onPress={() => setConfirming(null)} disabled={busy === a.id} />
                        <PillButton label="Confirm" variant="danger" size="sm" onPress={() => end(a)} loading={busy === a.id} />
                      </View>
                    </View>
                  ) : null}
                </View>
              )) : (
                <Text style={styles.muted}>No caregiver is assigned yet.</Text>
              )}
            </Card>
          )}
        </View>

        <View>
          <SectionHeading>Assign a Caregiver</SectionHeading>
          <Card style={styles.card}>
            <TextField
              label="Caregiver's phone number"
              value={phone}
              onChangeText={(t) => { setPhone(t); setPhoneError(null); }}
              error={phoneError}
              hint="The number their LindaCare caregiver account signs in with"
              placeholder="+254 7XX XXX XXX"
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="done"
              onSubmitEditing={assign}
            />
            <PillButton
              label="Assign"
              icon="person-add"
              full
              onPress={assign}
              loading={busy === 'assign'}
              disabled={!phone.trim()}
            />
          </Card>
        </View>

        {past.length ? (
          <View>
            <SectionHeading>Past Caregivers</SectionHeading>
            <Card style={styles.card}>
              {past.map((a) => (
                <View key={a.id} style={styles.memberRow}>
                  <View style={styles.memberText}>
                    <Text style={styles.name}>{a.caregiver.fullName}</Text>
                    <Text style={styles.muted}>
                      {a.startDate || '—'} to {a.endDate || '—'}
                    </Text>
                  </View>
                  <Chip compact tone="neutral" label="Ended" />
                </View>
              ))}
            </Card>
          </View>
        ) : null}
      </View>
    </PortalShell>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl },
  card: { gap: space.md },
  member: { gap: space.md },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  memberText: { flex: 1, gap: 2 },
  name: { ...type.bodyMedium, color: colors.ink },
  muted: { ...type.caption, color: colors.inkMuted },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  confirm: { gap: space.md, padding: space.md, borderRadius: 14, backgroundColor: colors.dangerBg },
  confirmText: { ...type.bodyMedium, color: colors.danger },
});
