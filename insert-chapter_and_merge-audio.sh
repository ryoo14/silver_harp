#!/bin/bash -e

check_command () {
  which "$1" > /dev/null 2>&1
}

log_info () {
  echo "INFO: $1"
}

log_error () {
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

format_audio_duration () {
  local raw_duration=$1
  raw_duration=${raw_duration%.*}
  if [[ $raw_duration == 00:* ]]; then
    local formatted_duration="${raw_duration:3}"
  else
    local formatted_duration="${raw_duration#0}"
  fi
  echo "$formatted_duration"
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

  log_info "Start to search RSS file from server."
  if [ ! -f "$RSS_FILE" ]; then
    log_error "Failed to search RSS file from server."
    exit 1
  fi
  log_success "Successfully searched RSS file from server."

  log_info "Start to merge audio and insert chapter."
  while IFS= read -r -d $'\n' file; do
    AUDIO_FILE_ARRAY+=("$file")
  done < <(find ./mp3 -type f -name "*.mp3" -exec basename {} \; | sort)
  if [ "${#AUDIO_FILE_ARRAY[@]}" -eq 0 ]; then
    log_info "The audio file does not exist."
    exit 0
  fi

  log_info "Start to input header to ${CHAPTER_TEXT_FILE}."
  echo ";FFMETADATA1" >> "$CHAPTER_TEXT_FILE"
  echo "" >> "$CHAPTER_TEXT_FILE"
  if [ -f "$CHAPTER_TEXT_FILE" ]; then
    log_success "Successfully created ${CHAPTER_TEXT_FILE}."
  else
    log_error "Failed to create ${CHAPTER_TEXT_FILE}."
    exit 1
  fi

  start=0
  log_info "Start to create chapter and entry for merge per audio."
  for audio in "${AUDIO_FILE_ARRAY[@]}"; do
    # insert the chapter info to the text file for chapter
    log_info "Start ${audio%.mp3}."
    duration=$(ffmpeg -i "./mp3/${audio}" 2>&1 | grep -i "duration:" | awk '{print $2}' | tr -d ",")
    msec_duration=$(calc_msec "$duration")
    end=$((start + msec_duration))
    title=${audio%.mp3}

    # check for single quote, pipe and coron in the title
    # if it contains, rename it to a hypthen
    if echo "$audio" | grep -E "'|\||:" > /dev/null; then
      log_info "It contains a unsupported character in ${audio}. Start to rename."
      audio_replace_title="${audio//\'/-}"
      audio_replace_title="${audio_replace_title//\|/-}"
      audio_replace_title="${audio_replace_title//:/-}"
      mv "./mp3/${audio}" "./mp3/${audio_replace_title}"
      if [ -f "./mp3/${audio_replace_title}" ]; then
        log_success "Successfully renamed ${audio} to ${audio_replace_title}."
        audio="$audio_replace_title"
      else
        log_error "Failed to rename."
      fi
    fi
    
    {
      echo "[CHAPTER]"
      echo "TIMEBASE=1/1000"
      echo "START=${start}"
      echo "END=${end}"
      echo "title=${title:0:20}"
      echo ""
    } >> "$CHAPTER_TEXT_FILE"
    
    start="$end"

    # insert the file path to the text file for merge
    echo "file '${audio}'" >> "$MERGE_TEXT_FILE"
    log_success "Finish ${audio%.mp3}."
  done

  # create the temporary merged audio
  log_info "Start to create tempotary merged audio."
  ffmpeg -f concat -safe 0 -i "$MERGE_TEXT_FILE" -c copy "$TMP_AUDIO_FILE"
  if [ -f "$TMP_AUDIO_FILE" ]; then
    log_success "Successfully created ${TMP_AUDIO_FILE}."
  else
    log_error "Failed to create ${TMP_AUDIO_FILE}."
    exit 1
  fi

  # create the merged audio with chapters
  log_info "Start to create merged audio."
  ffmpeg -i "$TMP_AUDIO_FILE" -i "$CHAPTER_TEXT_FILE" -map_metadata 1 -c copy "$MERGE_AUDIO_FILE"
  if [ -f "${MERGE_AUDIO_FILE}" ]; then
    log_success "Successfully created ${MERGE_AUDIO_FILE}."
  else
    log_error "Failed to create ${MERGE_AUDIO_FILE}."
    exit 1
  fi

  # create renew RSS
  if [ -f "$TMP_RSS_FILE" ]; then
    RSS_TIME=$([ "${YYYYMMDDHH:8:2}" -lt "05" ] && echo "の朝記事" || echo "の夜記事")
    RSS_TITLE="${YYYYMMDDHH:0:8}${RSS_TIME}"
    RSS_DATE=$(TZ="Asia/Tokyo" date "+%a, %d %b %Y %H:%M:%S %z")
    RSS_DURATION=$(format_audio_duration "$(ffmpeg -i "$MERGE_AUDIO_FILE" 2>&1 | grep -i "duration:" | awk '{print $2}' | tr -d ",")")
    RSS_AUDIO_FILE_LENGTH=$(ls -l "$MERGE_AUDIO_FILE" | awk '{print $5}')

    RSS_ITEM=$(sed -e "s/_TITLE/${RSS_TITLE}/g" -e "s/_DATE/${RSS_DATE}/g" -e "s/_AUDIOFILENAME/${YYYYMMDDHH}.mp3/g" -e "s/_AUDIOFILELENGTH/${RSS_AUDIO_FILE_LENGTH}/g" -e "s/_DURATION/${RSS_DURATION}/g" "$TMP_RSS_FILE")
    RSS_ITEM=$(echo "$RSS_ITEM" | sed ':a;N;$!ba;s/\n/\\n/g')
    sed -i -e "s|<language>ja</language>|&\n${RSS_ITEM}|" "$RSS_FILE"
  else
    log_error "${TMP_RSS_FILE} can't be found. The text-to-speech process might be failing or not operating."
    exit 1
  fi
else
  log_error "ffmpeg command can't be found."
  exit 1
fi
