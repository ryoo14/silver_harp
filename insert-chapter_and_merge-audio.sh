#!/bin/bash -e

check_command () {
  which "$1" > /dev/null 2>&1
}

log_info () {
  echo "INFO: $1"
}

log_fail () {
  echo -e "\033[31mERROR: ${1}\033[0m"
}

log_success () {
  echo -e "\033[34mSUCCESS: ${1}\033[0m"
}

calc_msec () {
  IFS=: read -r hours minutes seconds <<< "$1"

  # 秒とミリ秒を分割
  IFS=. read -r sec msec <<< "$seconds"

  # 時を秒に、分を秒に変換し、ミリ秒にする
  total_msec=$((10#$hours * 3600 * 1000 + 10#$minutes * 60 * 1000 + 10#$sec * 1000 + 10#$msec))

  echo "$total_msec"
}

handle_duration () {
  local time_data=$1
  time_data=${time_data%.*}
  if [[ $time_data == 00:* ]]; then
    local formatted_time="${time_data:3}"
  else
    local formatted_time="${time_data#0}"
  fi
  echo "$formatted_time"
}

if check_command ffmpeg; then
  YYYYMMDDHH=$(date +"%Y%m%d%H")
  AUDIO_FILE_ARRAY=()
  CHAPTER_TEXT_FILE="./mp3/chapter.txt"
  MERGE_AUDIO_FILE="./mp3/${YYYYMMDDHH}.mp3"
  MERGE_TEXT_FILE="./mp3/merge.txt"
  RSS_FILE="./mp3/silverharp.rss"
  TMP_AUDIO_FILE="./mp3/tmp.mp3"
  TMP_RSS_FILE="./mp3/tmp.rss"

  log_info "start to search RSS file from server"
  if [ ! -f "$RSS_FILE" ]; then
    log_fail "failed to search RSS file from server"
    exit 1
  fi
  log_success "success to search RSS file from server"

  log_info "start to insert chapter and merge audio"
  while IFS= read -r -d $'\n' file; do
    AUDIO_FILE_ARRAY+=("$file")
  done < <(find ./mp3 -type f -name "*.mp3" -exec basename {} \; | sort)
  if [ "${#AUDIO_FILE_ARRAY[@]}" -eq 0 ]; then
    log_info "audio file does not exist"
    exit 0
  fi

  log_info "start to input header to ${CHAPTER_TEXT_FILE}"
  echo ";FFMETADATA1" >> "$CHAPTER_TEXT_FILE"
  echo "" >> "$CHAPTER_TEXT_FILE"
  if [ -f "$CHAPTER_TEXT_FILE" ]; then
    log_success "create ${CHAPTER_TEXT_FILE}"
  else
    log_fail "failed to create ${CHAPTER_TEXT_FILE}"
    exit 1
  fi

  start=0
  log_info "start to create chapter and entry for merge per audio"
  for audio in "${AUDIO_FILE_ARRAY[@]}"; do
    # insert the chapter info to the text file for chapter
    log_info "start ${audio%.mp3}"
    duration=$(ffmpeg -i "./mp3/${audio}" 2>&1 | grep -i "duration:" | awk '{print $2}' | tr -d ",")
    msec_duration=$(calc_msec "$duration")
    end=$((start + msec_duration))
    title=${audio%.mp3}

    # check for single quote in the title
    # if it contains a single quote, rename it to a hypthen
    if echo "$audio" | grep "\'" > /dev/null; then
      log_info "it contains a single quote in ${audio}. start to rename."
      audio_replace_title="${audio//\'/-}"
      mv "./mp3/${audio}" "./mp3/${audio_replace_title}"
      if [ -f "./mp3/${audio_replace_title}" ]; then
        log_success "success to rename ${audio} to ${audio_replace_title}"
        audio="$audio_replace_title"
      else
        log_fail "failed to rename"
      fi
    fi
    
    {
      echo "[CHAPTER]"
      echo "TIMEBASE=1/1000"
      echo "START=${start}"
      echo "END=${end}"
      echo "title=${title}"
      echo ""
    } >> "$CHAPTER_TEXT_FILE"
    
    start="$end"

    # insert the file path to the text file for merge
    echo "file '${audio}'" >> "$MERGE_TEXT_FILE"
    log_success "finish ${audio%.mp3}"
  done

  # create the temporary merged audio
  log_info "start to create tempotary merged audio"
  ffmpeg -f concat -safe 0 -i "$MERGE_TEXT_FILE" -c copy "$TMP_AUDIO_FILE"
  if [ -f "$TMP_AUDIO_FILE" ]; then
    log_success "finish to create ${TMP_AUDIO_FILE}"
  else
    log_fail "failed to create ${TMP_AUDIO_FILE}"
    exit 1
  fi

  # create the merged audio with chapters
  log_info "start to create merged audio"
  ffmpeg -i "$TMP_AUDIO_FILE" -i "$CHAPTER_TEXT_FILE" -map_metadata 1 -c copy "$MERGE_AUDIO_FILE"
  if [ -f "${MERGE_AUDIO_FILE}" ]; then
    log_success "finish to create ${MERGE_AUDIO_FILE}"
  else
    log_fail "failed to create ${MERGE_AUDIO_FILE}"
    exit 1
  fi

  # create renwe RSS
  if [ -f "$TMP_RSS_FILE" ]; then
    RSS_TIME=$([ "${YYYYMMDDHH:8:2}" -lt "05" ] && echo "の朝記事" || echo "の夜記事")
    RSS_TITLE="${YYYYMMDDHH:0:8}${RSS_TIME}"
    RSS_DATE=$(TZ="Asia/Tokyo" date "+%a, %d %b %Y %H:%M:%S %z")
    RSS_DURATION=$(handle_duration "$(ffmpeg -i "$MERGE_AUDIO_FILE" 2>&1 | grep -i "duration:" | awk '{print $2}' | tr -d ",")")
    RSS_AUDIO_FILE_LENGTH=$(ls -l "$MERGE_AUDIO_FILE" | awk '{print $5}')

    RSS_ITEM=$(sed -e "s/_TITLE/${RSS_TITLE}/g" -e "s/_DATE/${RSS_DATE}/g" -e "s/_AUDIOFILENAME/${YYYYMMDDHH}.mp3/g" -e "s/_AUDIOFILELENGTH/${RSS_AUDIO_FILE_LENGTH}/g" -e "s/_DURATION/${RSS_DURATION}/g" "$TMP_RSS_FILE")
    RSS_ITEM=$(echo "$RSS_ITEM" | sed ':a;N;$!ba;s/\n/\\n/g')
    sed -i -e "s@<language>ja</language>@&\n${RSS_ITEM}@" "$RSS_FILE"
  else
    log_fail "not found ${TMP_RSS_FILE}"
  fi
else
  log_fail "ffmpeg command not found"
  exit 1
fi
