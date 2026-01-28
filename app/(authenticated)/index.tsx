import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCYbMdj4qXAQ42v-LLa_FxNHhgjuzH1P1mlc9b0GPEXOImgfrxfyfhLESxY9peLQr9ObnzcAepqy2GwBf5OE_FccWE2bc_6jH-7K29AhomKWlzqzvflEwlnEqq3u9YdcqtQnH-NlXBo4_INlh3ALwTq-Cusm65oWI_tpjKQs5tIM_7ni6CeLXJp3tczrT1CtAJDDdoES_nprtEr3OcS3Hx_jVlrXCg0al9X3UQw_QxnK4MOev4pX0n4oT3UlTbewlk1WXjDsqbLDp5V';
const PRIMARY = '#308ce8';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* ===== Header ===== */}
        <View style={styles.header}>
          <View style={styles.headerRightSide}>
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: AVATAR }} style={styles.avatar} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.greetingSmall}>צהריים טובים,</Text>
              <Text style={styles.greetingBig}>ברוכה הבאה, יעל</Text>
            </View>
          </View>

          <View style={styles.headerLeftSide}>
            <View style={styles.logoAndBell}>
              <Pressable style={styles.bellButton}>
                <MaterialIcons
                  name="notifications-none"
                  size={22}
                  color="#111418"
                />
                <View style={styles.bellDot} />
              </Pressable>
              <Text style={styles.logoText}>Infera</Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ===== Date & summary ===== */}
          <View style={styles.dateBlock}>
            <Text style={styles.dateText}>יום שלישי, 24 באוקטובר</Text>
            <Text style={styles.daySummary}>יש לך 4 פעילויות היום</Text>
          </View>

          {/* ===== Next event card ===== */}
          <View style={styles.nextEventCard}>
            <View style={styles.blueStrip} />
            <View style={styles.nextEventContent}>
              <View style={styles.nextEventHeaderRow}>
                <View style={styles.nextEventTitleBlock}>
                  <Text style={styles.nextEventChip}>האירוע הקרוב</Text>
                  <Text style={styles.nextEventTitle}>פגישה עם המורה</Text>
                  <View style={styles.locationRow}>
                    <MaterialIcons
                      name="location-on"
                      size={16}
                      color="#637588"
                    />
                    <Text style={styles.locationText}>
                      בית ספר יסודי "אלונים"
                    </Text>
                  </View>
                </View>
                <Text style={styles.nextEventTime}>09:00</Text>
              </View>

              <View style={styles.nextEventFooterRow}>
                <Pressable style={styles.navigateButton}>
                  <MaterialIcons name="near-me" size={18} color="#8d6e63" />
                  <Text style={styles.navigateText}>נווט</Text>
                </Pressable>
                <View style={styles.participantsRow}>
                  <View style={[styles.participant, styles.moreParticipants]}>
                    <Text style={styles.moreParticipantsText}>+2</Text>
                  </View>
                  <Image source={{ uri: AVATAR }} style={styles.participant} />
                </View>
              </View>
            </View>
          </View>

          {/* ===== Birthdays ===== */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>🎂 ימי הולדת קרובים</Text>
            <Pressable>
              <Text style={styles.linkText}>ראה הכל</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.birthdaysRow}
          >
            <BirthdayCard label="מחר:" name="אמא" />
            <BirthdayCard label="בעוד 5 ימים:" name="דנה" />
            <BirthdayCard label="בעוד 8 ימים:" name="מיכל" />
          </ScrollView>

          {/* ===== Rest of the day ===== */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>המשך היום</Text>
            <Pressable>
              <Text style={styles.linkText}>ראה הכל</Text>
            </Pressable>
          </View>

          <TimelineItem
            time="13:00"
            title="ארוחת צהריים משפחתית"
            subtitle="מסעדה איטלקית במרכז העיר"
            icon="restaurant"
            iconColor="#f97316"
            iconBg="#ffedd5"
          />

          <TimelineItem
            time="16:30"
            title="לקנות חלב ולחם"
            subtitle="סופר שכונתי"
            icon="shopping-cart"
            iconColor="#2563eb"
            iconBg="#dbeafe"
            withCheckbox
          />

          <TimelineItem
            time="18:30"
            title="חוג יוגה"
            subtitle='סטודיו "נשימה"'
            icon="self-improvement"
            iconColor="#8b5cf6"
            iconBg="#ede9fe"
            showLine={false}
          />
        </ScrollView>

        {/* ===== Floating Action Button (FAB) ===== */}
        {/* השארתי את הפלוס כי הוא חלק מהמסך ולא חלק מתפריט הניווט הכללי */}
        <Pressable style={styles.fab} onPress={() => {}}>
          <MaterialIcons name="add" size={30} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// --- Sub-Components ---

function TimelineItem({
  time,
  title,
  subtitle,
  icon,
  iconColor,
  iconBg,
  withCheckbox,
  showLine = true,
}: any) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timeColumn}>
        <Text style={styles.timeText}>{time}</Text>
        {showLine && <View style={styles.timeLine} />}
      </View>
      <View style={styles.timelineCard}>
        <View style={styles.timelineCardContent}>
          <View style={styles.textAndCheckRow}>
            {withCheckbox && (
              <View style={styles.checkboxOuter}>
                <View style={styles.checkboxInner} />
              </View>
            )}
            <View style={styles.textContent}>
              <Text style={styles.timelineTitle}>{title}</Text>
              <Text style={styles.timelineSubtitle}>{subtitle}</Text>
            </View>
          </View>
          <View
            style={[styles.timelineIconWrapper, { backgroundColor: iconBg }]}
          >
            <MaterialIcons name={icon} size={18} color={iconColor} />
          </View>
        </View>
      </View>
    </View>
  );
}

function BirthdayCard({ label, name }: any) {
  return (
    <View style={styles.birthdayCard}>
      <Image source={{ uri: AVATAR }} style={styles.birthdayAvatar} />
      <View>
        <Text style={styles.birthdayLabel}>{label}</Text>
        <Text style={styles.birthdayName}>{name}</Text>
      </View>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#f6f7f8', direction: 'rtl' },
  scrollContent: { paddingBottom: 100 },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerRightSide: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerText: { alignItems: 'flex-start' },
  greetingSmall: { fontSize: 12, color: '#637588', fontWeight: '500' },
  greetingBig: { fontSize: 18, fontWeight: '700', color: '#111418' },
  headerLeftSide: { flexDirection: 'row', alignItems: 'center' },
  logoAndBell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  bellButton: { position: 'relative' },
  bellDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },

  /* Sections */
  dateBlock: { paddingHorizontal: 16, marginTop: 20 },
  dateText: { fontSize: 24, fontWeight: '800', color: '#111418' },
  daySummary: { fontSize: 14, color: '#637588', marginTop: 4 },

  /* Event Card */
  nextEventCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  blueStrip: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: PRIMARY,
  },
  nextEventContent: { padding: 20 },
  nextEventHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  nextEventTitleBlock: { flex: 1 },
  nextEventChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0ecff',
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nextEventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111418',
    marginTop: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  locationText: { fontSize: 13, color: '#637588' },
  nextEventTime: { fontSize: 28, fontWeight: '800', color: PRIMARY },
  nextEventFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f0ee',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  navigateText: { fontSize: 14, fontWeight: '700', color: '#8d6e63' },
  participantsRow: { flexDirection: 'row' },
  participant: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
    marginRight: -10,
  },
  moreParticipants: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreParticipantsText: { fontSize: 11, fontWeight: '700' },

  /* Birthdays */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  linkText: { fontSize: 13, color: PRIMARY, fontWeight: '700' },
  birthdaysRow: { paddingLeft: 16, marginTop: 12 },
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  birthdayAvatar: { width: 36, height: 36, borderRadius: 18, marginLeft: 10 },
  birthdayLabel: { fontSize: 10, color: '#9ca3af' },
  birthdayName: { fontSize: 14, fontWeight: '700' },

  /* Timeline */
  timelineRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 15,
  },
  timeColumn: { width: 60, alignItems: 'center' },
  timeText: { fontSize: 15, fontWeight: '700', color: '#6b7280' },
  timeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 8,
    borderRadius: 1,
  },
  timelineCard: { flex: 1, marginLeft: 10 },
  timelineCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textAndCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  textContent: { flex: 1 },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: '#111418' },
  timelineSubtitle: { fontSize: 13, color: '#637588', marginTop: 2 },
  timelineIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },

  /* FAB - כפתור הפלוס */
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});