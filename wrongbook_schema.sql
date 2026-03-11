create table students (
  student_id varchar(20) primary key,
  full_name varchar(120) not null,
  class_name varchar(80) not null,
  grade_level varchar(20),
  created_at timestamp not null default current_timestamp
);

create table question_bank (
  question_id varchar(10) primary key,
  local_id varchar(10) not null,
  section_code varchar(10) not null,
  section_name varchar(120) not null,
  stem text not null,
  option_count integer not null,
  payload_json text not null,
  created_at timestamp not null default current_timestamp
);

create table mistake_records (
  record_id varchar(20) primary key,
  student_id varchar(20) not null references students(student_id),
  question_id varchar(10) not null references question_bank(question_id),
  wrong_count integer not null default 1,
  correct_streak integer not null default 0,
  status varchar(20) not null default 'new',
  last_wrong_on date,
  next_review_on date,
  teacher_note text,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp
);

create table review_logs (
  review_id integer generated always as identity primary key,
  record_id varchar(20) not null references mistake_records(record_id),
  reviewed_on date not null,
  result varchar(20) not null,
  reviewer varchar(80),
  note text
);

create table question_sets (
  set_id varchar(20) primary key,
  owner_student_id varchar(20) references students(student_id),
  set_name varchar(120) not null,
  set_type varchar(20) not null default 'manual',
  created_at timestamp not null default current_timestamp
);

create table question_set_items (
  set_id varchar(20) not null references question_sets(set_id),
  question_id varchar(10) not null references question_bank(question_id),
  added_at timestamp not null default current_timestamp,
  primary key (set_id, question_id)
);

create table wordbook_entries (
  word_id integer generated always as identity primary key,
  owner_student_id varchar(20) references students(student_id),
  lemma varchar(120) not null,
  source_question_id varchar(10) references question_bank(question_id),
  cambridge_url text,
  merriam_url text,
  memory_hooks_json text,
  authority_examples_json text,
  derivatives_json text,
  created_at timestamp not null default current_timestamp
);

create table flashcard_reviews (
  flashcard_review_id integer generated always as identity primary key,
  word_id integer not null references wordbook_entries(word_id),
  reviewed_at timestamp not null default current_timestamp,
  rating varchar(20) not null,
  next_due_at timestamp
);

create index idx_mistake_records_student on mistake_records(student_id);
create index idx_mistake_records_question on mistake_records(question_id);
create index idx_mistake_records_status on mistake_records(status);
create index idx_mistake_records_review_date on mistake_records(next_review_on);
create index idx_question_set_items_question on question_set_items(question_id);
create index idx_wordbook_entries_student on wordbook_entries(owner_student_id);
create index idx_wordbook_entries_lemma on wordbook_entries(lemma);
