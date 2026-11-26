--
-- PostgreSQL database dump
--

\restrict Ja2JzjVrTWyloAZQ8ljnZLkdYJaMwIehclMW3X8AITAManXmzbrjk7vabXVU4rg

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: audit_logs_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_logs_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs is append-only: rows cannot be deleted';
  END IF;

  IF NEW.id = OLD.id
     AND NEW.event_type = OLD.event_type
     AND NEW.event_detail IS NOT DISTINCT FROM OLD.event_detail
     AND NEW.explanation IS NOT DISTINCT FROM OLD.explanation
     AND NEW.severity = OLD.severity
     AND NEW.logged_at = OLD.logged_at
     AND NEW.resource_type IS NOT DISTINCT FROM OLD.resource_type
     AND NEW.resource_id IS NOT DISTINCT FROM OLD.resource_id
     AND NEW.action IS NOT DISTINCT FROM OLD.action
     AND NEW.decision IS NOT DISTINCT FROM OLD.decision
     AND NEW.actor_type IS NOT DISTINCT FROM OLD.actor_type
     AND NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address
     AND (NEW.user_id IS NULL OR NEW.user_id IS NOT DISTINCT FROM OLD.user_id)
     AND (NEW.session_id IS NULL OR NEW.session_id IS NOT DISTINCT FROM OLD.session_id)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_logs is append-only: recorded events cannot be modified';
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: anomaly_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anomaly_scores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    login_event_id uuid NOT NULL,
    isolation_forest_score numeric(5,2),
    location_deviation numeric(6,2),
    known_device boolean DEFAULT false,
    velocity_count integer DEFAULT 1,
    risk_level character varying(10) DEFAULT 'low'::character varying NOT NULL,
    explanation text,
    created_at timestamp without time zone DEFAULT now(),
    action character varying(20),
    governed_by character varying(20),
    cold_start boolean DEFAULT false,
    model_available boolean DEFAULT true,
    features jsonb,
    review_status character varying(20),
    review_note text,
    reviewed_at timestamp without time zone,
    reviewed_by uuid,
    CONSTRAINT anomaly_scores_review_status_check CHECK (((review_status IS NULL) OR ((review_status)::text = ANY ((ARRAY['true_positive'::character varying, 'false_positive'::character varying, 'under_review'::character varying])::text[])))),
    CONSTRAINT anomaly_scores_risk_level_check CHECK (((risk_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))),
    CONSTRAINT anomaly_scores_score_range_check CHECK (((isolation_forest_score IS NULL) OR ((isolation_forest_score >= (0)::numeric) AND (isolation_forest_score <= (100)::numeric))))
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    caregiver_id uuid NOT NULL,
    elderly_profile_id uuid NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    start_date date DEFAULT CURRENT_DATE,
    end_date date,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT assignments_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_id uuid,
    user_id uuid,
    event_type character varying(50) NOT NULL,
    event_detail text,
    explanation text,
    severity character varying(10) DEFAULT 'info'::character varying NOT NULL,
    logged_at timestamp without time zone DEFAULT now(),
    resource_type character varying(40),
    resource_id uuid,
    action character varying(40),
    decision character varying(10),
    ip_address character varying(45),
    actor_type character varying(20),
    CONSTRAINT audit_logs_actor_type_check CHECK (((actor_type IS NULL) OR ((actor_type)::text = ANY ((ARRAY['user'::character varying, 'administrator'::character varying, 'automated'::character varying, 'system'::character varying])::text[])))),
    CONSTRAINT audit_logs_decision_check CHECK (((decision IS NULL) OR ((decision)::text = ANY ((ARRAY['allow'::character varying, 'deny'::character varying])::text[])))),
    CONSTRAINT audit_logs_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: elderly_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.elderly_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    family_member_id uuid NOT NULL,
    full_name character varying(100) NOT NULL,
    home_address text,
    date_of_birth date,
    medical_notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: login_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    ip_address character varying(45),
    device_fingerprint character varying(255),
    latitude numeric(9,6),
    longitude numeric(9,6),
    login_velocity integer DEFAULT 1,
    login_time timestamp without time zone DEFAULT now(),
    was_successful boolean DEFAULT false,
    country character varying(2),
    city character varying(100)
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    subject_user_id uuid,
    event_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'info'::character varying NOT NULL,
    message text NOT NULL,
    channel character varying(20) DEFAULT 'sms'::character varying NOT NULL,
    delivery_status character varying(20) NOT NULL,
    delivery_error character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    read_at timestamp without time zone,
    CONSTRAINT notifications_delivery_status_check CHECK (((delivery_status)::text = ANY ((ARRAY['sent'::character varying, 'failed'::character varying, 'suppressed'::character varying, 'skipped'::character varying, 'dev_logged'::character varying])::text[]))),
    CONSTRAINT notifications_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    phone_number character varying(20) NOT NULL,
    otp_code character varying(64) NOT NULL,
    purpose character varying(20) NOT NULL,
    is_used boolean DEFAULT false,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    attempts integer DEFAULT 0 NOT NULL,
    CONSTRAINT otps_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['login'::character varying, 'registration'::character varying, 'step_up'::character varying, 'recovery'::character varying, 'phone_change'::character varying])::text[])))
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid,
    token text NOT NULL,
    provider text NOT NULL,
    platform text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text]))),
    CONSTRAINT push_tokens_provider_check CHECK ((provider = ANY (ARRAY['expo'::text, 'fcm'::text, 'apns'::text])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    user_role character varying(20) NOT NULL,
    refresh_token text NOT NULL,
    risk_score numeric(5,2) DEFAULT 0,
    device_fingerprint character varying(255),
    ip_address character varying(45),
    session_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone NOT NULL,
    last_seen_ip character varying(45),
    last_seen_at timestamp without time zone,
    flagged_reason character varying(50),
    flagged_at timestamp without time zone,
    CONSTRAINT sessions_risk_score_range_check CHECK (((risk_score IS NULL) OR ((risk_score >= (0)::numeric) AND (risk_score <= (100)::numeric)))),
    CONSTRAINT sessions_session_status_check CHECK (((session_status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'invalidated'::character varying, 'flagged'::character varying])::text[])))
);


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_devices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    device_fingerprint character varying(255) NOT NULL,
    device_label character varying(100),
    trusted_at timestamp without time zone DEFAULT now(),
    last_seen_at timestamp without time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    phone_number character varying(20) NOT NULL,
    email character varying(255),
    full_name character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    account_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    device_fingerprint character varying(255),
    verification_status character varying(20) DEFAULT 'unverified'::character varying,
    backup_email character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    phone_verified boolean DEFAULT false NOT NULL,
    consent_at timestamp without time zone,
    locked_until timestamp without time zone,
    national_id_hash character varying(64),
    national_id_last4 character varying(4),
    county character varying(40),
    country_code character(2) DEFAULT 'KE'::bpchar NOT NULL,
    care_recipient_name character varying(100),
    relationship_to_recipient character varying(20),
    notification_prefs jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT users_account_status_check CHECK (((account_status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'suspended'::character varying, 'frozen'::character varying])::text[]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['family'::character varying, 'caregiver'::character varying, 'administrator'::character varying])::text[]))),
    CONSTRAINT users_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['unverified'::character varying, 'verified'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: COLUMN users.national_id_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.national_id_hash IS 'HMAC-SHA256 of the normalised national ID under NATIONAL_ID_SECRET. Caregivers only; never the plaintext.';


--
-- Name: COLUMN users.national_id_last4; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.national_id_last4 IS 'Last four digits, for support to confirm an identity over the phone without the full number.';


--
-- Name: COLUMN users.country_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.country_code IS 'ISO 3166-1 alpha-2 country of residence. KE for every caregiver; family members may be in the diaspora.';


--
-- Name: COLUMN users.care_recipient_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.care_recipient_name IS 'The person a family member is registering to follow. Family members only.';


--
-- Name: anomaly_scores anomaly_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_scores
    ADD CONSTRAINT anomaly_scores_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: elderly_profiles elderly_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elderly_profiles
    ADD CONSTRAINT elderly_profiles_pkey PRIMARY KEY (id);


--
-- Name: login_events login_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_events
    ADD CONSTRAINT login_events_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_refresh_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_refresh_token_key UNIQUE (refresh_token);


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_user_id_device_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_device_fingerprint_key UNIQUE (user_id, device_fingerprint);


--
-- Name: users users_caregiver_locality_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.users
    ADD CONSTRAINT users_caregiver_locality_check CHECK ((((role)::text <> 'caregiver'::text) OR (country_code = 'KE'::bpchar))) NOT VALID;


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_national_id_role_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.users
    ADD CONSTRAINT users_national_id_role_check CHECK (((national_id_hash IS NULL) OR ((role)::text = 'caregiver'::text))) NOT VALID;


--
-- Name: users users_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_relationship_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.users
    ADD CONSTRAINT users_relationship_check CHECK (((relationship_to_recipient IS NULL) OR ((relationship_to_recipient)::text = ANY ((ARRAY['child'::character varying, 'spouse'::character varying, 'parent'::character varying, 'sibling'::character varying, 'grandchild'::character varying, 'niece_nephew'::character varying, 'in_law'::character varying, 'guardian'::character varying, 'other'::character varying])::text[])))) NOT VALID;


--
-- Name: idx_anomaly_scores_action_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomaly_scores_action_time ON public.anomaly_scores USING btree (action, created_at DESC) WHERE (action IS NOT NULL);


--
-- Name: idx_anomaly_scores_login_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomaly_scores_login_event ON public.anomaly_scores USING btree (login_event_id);


--
-- Name: idx_anomaly_scores_reviewed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomaly_scores_reviewed ON public.anomaly_scores USING btree (review_status, reviewed_at DESC) WHERE (review_status IS NOT NULL);


--
-- Name: idx_anomaly_scores_risk_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomaly_scores_risk_time ON public.anomaly_scores USING btree (risk_level, created_at DESC);


--
-- Name: idx_anomaly_scores_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomaly_scores_time ON public.anomaly_scores USING btree (created_at DESC);


--
-- Name: idx_anomaly_scores_unreviewed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomaly_scores_unreviewed ON public.anomaly_scores USING btree (created_at DESC) WHERE ((review_status IS NULL) AND ((action)::text IS DISTINCT FROM 'allow'::text));


--
-- Name: idx_assignments_access; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_access ON public.assignments USING btree (caregiver_id, elderly_profile_id, status);


--
-- Name: idx_assignments_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_assignments_one_active ON public.assignments USING btree (caregiver_id, elderly_profile_id) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_assignments_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_profile ON public.assignments USING btree (elderly_profile_id, status);


--
-- Name: idx_audit_actions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actions ON public.audit_logs USING btree (action, logged_at DESC) WHERE (action IS NOT NULL);


--
-- Name: idx_audit_denials; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_denials ON public.audit_logs USING btree (logged_at DESC) WHERE ((decision)::text = 'deny'::text);


--
-- Name: idx_audit_event_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_event_time ON public.audit_logs USING btree (event_type, logged_at DESC);


--
-- Name: idx_audit_ip_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_ip_time ON public.audit_logs USING btree (ip_address, logged_at DESC) WHERE (ip_address IS NOT NULL);


--
-- Name: idx_audit_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_resource ON public.audit_logs USING btree (resource_type, resource_id, logged_at DESC);


--
-- Name: idx_audit_session_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_session_time ON public.audit_logs USING btree (session_id, logged_at DESC);


--
-- Name: idx_audit_severity_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_severity_time ON public.audit_logs USING btree (severity, logged_at DESC);


--
-- Name: idx_audit_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_time ON public.audit_logs USING btree (logged_at DESC);


--
-- Name: idx_audit_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user_time ON public.audit_logs USING btree (user_id, logged_at DESC);


--
-- Name: idx_elderly_profiles_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_elderly_profiles_owner ON public.elderly_profiles USING btree (family_member_id, created_at DESC);


--
-- Name: idx_login_events_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_events_time ON public.login_events USING btree (login_time DESC);


--
-- Name: idx_login_events_user_last_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_events_user_last_success ON public.login_events USING btree (user_id, login_time DESC) WHERE was_successful;


--
-- Name: idx_login_events_user_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_events_user_success ON public.login_events USING btree (user_id, was_successful, login_time DESC);


--
-- Name: idx_login_events_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_events_user_time ON public.login_events USING btree (user_id, login_time DESC);


--
-- Name: idx_notifications_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_time ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_otps_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otps_lookup ON public.otps USING btree (phone_number, purpose, created_at DESC);


--
-- Name: idx_sessions_active_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_active_seen ON public.sessions USING btree (session_status, COALESCE(last_seen_at, created_at) DESC) WHERE ((session_status)::text = 'active'::text);


--
-- Name: idx_sessions_flagged_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_flagged_time ON public.sessions USING btree (flagged_at DESC) WHERE (flagged_reason IS NOT NULL);


--
-- Name: idx_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_active ON public.sessions USING btree (user_id, session_status);


--
-- Name: idx_sessions_user_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_seen ON public.sessions USING btree (user_id, COALESCE(last_seen_at, created_at) DESC);


--
-- Name: idx_trusted_devices_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trusted_devices_lookup ON public.trusted_devices USING btree (user_id, device_fingerprint);


--
-- Name: idx_users_county_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_county_role ON public.users USING btree (county, role) WHERE (county IS NOT NULL);


--
-- Name: idx_users_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_created ON public.users USING btree (created_at DESC);


--
-- Name: idx_users_national_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_national_id ON public.users USING btree (national_id_hash) WHERE (national_id_hash IS NOT NULL);


--
-- Name: idx_users_role_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_status ON public.users USING btree (role, account_status);


--
-- Name: push_tokens_by_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_tokens_by_session ON public.push_tokens USING btree (session_id) WHERE (revoked_at IS NULL);


--
-- Name: push_tokens_by_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_tokens_by_user ON public.push_tokens USING btree (user_id) WHERE (revoked_at IS NULL);


--
-- Name: push_tokens_live_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX push_tokens_live_token ON public.push_tokens USING btree (token) WHERE (revoked_at IS NULL);


--
-- Name: audit_logs trg_audit_logs_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_logs_append_only BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_logs_append_only();


--
-- Name: anomaly_scores anomaly_scores_login_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_scores
    ADD CONSTRAINT anomaly_scores_login_event_id_fkey FOREIGN KEY (login_event_id) REFERENCES public.login_events(id) ON DELETE CASCADE;


--
-- Name: anomaly_scores anomaly_scores_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_scores
    ADD CONSTRAINT anomaly_scores_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assignments assignments_caregiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_caregiver_id_fkey FOREIGN KEY (caregiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_elderly_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_elderly_profile_id_fkey FOREIGN KEY (elderly_profile_id) REFERENCES public.elderly_profiles(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: elderly_profiles elderly_profiles_family_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elderly_profiles
    ADD CONSTRAINT elderly_profiles_family_member_id_fkey FOREIGN KEY (family_member_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: login_events login_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_events
    ADD CONSTRAINT login_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_subject_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_subject_user_id_fkey FOREIGN KEY (subject_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: trusted_devices trusted_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Ja2JzjVrTWyloAZQ8ljnZLkdYJaMwIehclMW3X8AITAManXmzbrjk7vabXVU4rg

