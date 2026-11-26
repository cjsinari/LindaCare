import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PortalShell from '../../components/caregiver/PortalShell';
import Card, { Divider, Field, SectionHeading } from '../../components/oneui/Card';
import Chip from '../../components/oneui/Chip';
import PillButton from '../../components/oneui/PillButton';
import { ListSkeleton, ListError } from '../../components/oneui/ListState';
import ResponseBanner, { failed, ok } from '../../components/ResponseBanner';
import useAsyncResource from '../../hooks/useAsyncResource';
import { profiles as profilesApi } from '../../api/endpoints';
import { colors, space, type } from '../../theme/tokens';
import ProfileForm from './ProfileForm';
import {
  ACCESS_LABEL, bodyFrom, changedFields, fieldErrors, formFrom, useProfilePermissions,
} from './shared';

/*
 * One care profile: who they are, and on what authority you are reading it.
 *
 * ── The access badge is the service's word, not the app's ──
 *
 * It is `accessVia` from GET /profiles/:id -- "Family owner", or "Assigned
 * caregiver, read-only" -- so it reports the rule that actually let this read
 * through, and a caregiver whose assignment ends stops seeing the profile at
 * all rather than seeing a stale badge.
 *
 * ── Edit, Delete and Care team ──
 *
 * Drawn for the family owner, and in demo mode for everyone. Whoever presses
 * them, the service decides; its answer goes in the banner and stays there,
 * and the buttons stay too, so a refused edit can be tried again and refused
 * again in front of whoever is watching.
 *
 * Delete is confirmed in place, not in Alert.alert: a dialog with buttons does
 * nothing on react-native-web, and an in-screen row also keeps the question
 * next to the thing it is about.
 */
export default function CareProfileDetailScreen({ navigation, route }) {
  const id = route?.params?.id;
  const [result, setResult] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState('view'); // view | edit | confirmDelete | deleted
  const [form, setForm] = useState(formFrom(null));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await profilesApi.get(id);
      setProfile(data.profile);
      setResult(ok(200, `${data.profile.fullName}: ${ACCESS_LABEL[data.profile.accessVia] || 'access granted'}.`));
      return data;
    } catch (err) {
      setResult(failed(err));
      throw err;
    }
  }, [id]);

  const { status, error, isRefreshing, reload } = useAsyncResource(load, [id]);
  const { canManage } = useProfilePermissions(profile);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('CareProfiles'));

  const startEdit = () => {
    setForm(formFrom(profile));
    setErrors({});
    setMode('edit');
  };

  const save = async () => {
    if (busy) return;
    // Only what changed. Saving with nothing changed still asks the service
    // (with the name as it is), so pressing Save always gets an answer.
    const changed = changedFields(form, profile);
    const body = bodyFrom(form, { only: changed.length ? changed : ['fullName'] });
    setBusy(true);
    setErrors({});
    try {
      const data = await profilesApi.update(id, body);
      setProfile(data.profile);
      setResult(ok(200, 'Changes saved.'));
      setMode('view');
    } catch (err) {
      setErrors(fieldErrors(err));
      setResult(failed(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await profilesApi.remove(id);
      const notice = ok(200, data?.message || 'Care profile deleted.');
      setResult(notice);
      setMode('deleted');
    } catch (err) {
      setResult(failed(err));
      setMode('view');
    } finally {
      setBusy(false);
    }
  };

  const title = profile?.fullName || 'Care profile';

  return (
    <PortalShell
      navigation={navigation}
      active="CareProfiles"
      barTitle={title}
      title={title}
      subtitle="Care profile"
      onBack={back}
      onRefresh={mode === 'view' ? () => reload({ quiet: true }) : null}
      refreshing={isRefreshing}
    >
      <View style={styles.sections}>
        <ResponseBanner result={result} quietSuccess />

        {mode === 'deleted' ? (
          <Card style={styles.card}>
            <Text style={styles.body}>This profile has been deleted, along with its care team.</Text>
            <PillButton
              label="Back to care profiles"
              onPress={() => navigation.navigate('CareProfiles', { notice: result })}
            />
          </Card>
        ) : null}

        {mode !== 'deleted' && status === 'loading' ? <ListSkeleton rows={2} height={120} /> : null}

        {mode !== 'deleted' && !profile && status === 'error' ? (
          <ListError error={error} title="Could not open this profile" onRetry={() => reload()} />
        ) : null}

        {mode !== 'deleted' && profile ? (
          <>
            <Card style={styles.card}>
              <View style={styles.badgeRow}>
                <Text style={styles.badgeLabel}>ACCESS</Text>
                <Chip
                  tone={profile.accessVia === 'family_owner' ? 'active' : 'upcoming'}
                  label={ACCESS_LABEL[profile.accessVia] || 'Access granted'}
                />
              </View>
            </Card>

            {mode === 'edit' ? (
              <View>
                <SectionHeading>Edit Profile</SectionHeading>
                <Card style={styles.card}>
                  <ProfileForm form={form} onChange={setForm} errors={errors} />
                  <View style={styles.actions}>
                    <PillButton label="Cancel" variant="quiet" onPress={() => setMode('view')} disabled={busy} />
                    <PillButton label="Save changes" onPress={save} loading={busy} />
                  </View>
                </Card>
              </View>
            ) : (
              <View>
                <SectionHeading>Details</SectionHeading>
                <Card style={styles.card}>
                  <Field label="Full name" value={profile.fullName} />
                  <Divider inset={0} />
                  <Field label="Date of birth" value={profile.dateOfBirth} />
                  <Divider inset={0} />
                  <Field label="Home address" value={profile.homeAddress} />
                  <Divider inset={0} />
                  <Field label="Medical notes" value={profile.medicalNotes} />
                </Card>
              </View>
            )}

            {canManage && mode !== 'edit' ? (
              <View>
                <SectionHeading>Manage</SectionHeading>
                <Card style={styles.card}>
                  <PillButton label="Edit" icon="create-outline" variant="tonal" full onPress={startEdit} />
                  <PillButton
                    label="Care team"
                    icon="people-outline"
                    variant="tonal"
                    full
                    onPress={() => navigation.navigate('CareTeam', { id, name: profile.fullName })}
                  />
                  {mode === 'confirmDelete' ? (
                    <View style={styles.confirm} accessibilityRole="alert">
                      <Text style={styles.confirmText}>Delete this profile? Its care team loses access too.</Text>
                      <View style={styles.actions}>
                        <PillButton label="Cancel" variant="quiet" onPress={() => setMode('view')} disabled={busy} />
                        <PillButton label="Confirm delete" variant="danger" onPress={remove} loading={busy} />
                      </View>
                    </View>
                  ) : (
                    <PillButton
                      label="Delete"
                      icon="trash-outline"
                      variant="danger"
                      full
                      onPress={() => setMode('confirmDelete')}
                    />
                  )}
                </Card>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </PortalShell>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl },
  card: { gap: space.md },
  body: { ...type.body, color: colors.ink },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  badgeLabel: { ...type.label, color: colors.label },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  confirm: { gap: space.md, padding: space.md, borderRadius: 14, backgroundColor: colors.dangerBg },
  confirmText: { ...type.bodyMedium, color: colors.danger },
});
