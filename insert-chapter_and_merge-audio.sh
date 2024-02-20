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

if check_command ffmpeg; then
  log_info "start to insert chapter and merge audio"

  AUDIO_FILE_ARRAY=()
  while IFS= read -r -d $'\n' file; do
    AUDIO_FILE_ARRAY+=("$file")
  done < <(find ./mp3 -type f -name "*.mp3" -exec basename {} \; | sort)
  YYYYMMDDHH=$(date +"%Y%m%d%H")
  MERGE_AUDIO_FILE="./mp3/${YYYYMMDDHH}.mp3"
  MERGE_TEXT_FILE="./mp3/merge.txt"
  CHAPTER_TEXT_FILE="./mp3/chapter.txt"

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
    DURATION=$(ffmpeg -i "./mp3/${audio}" 2>&1 | grep -i "duration:" | awk '{print $2}' | tr -d ",")
    duration=$(calc_msec "$DURATION")
    end=$((start + duration))
    title=${audio%.mp3}
    
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
  ffmpeg -f concat -safe 0 -i "$MERGE_TEXT_FILE" -c copy ./mp3/tmp.mp3 > /dev/null 2>&1 
  if [ -f "./mp3/tmp.mp3" ]; then
    log_success "finish to create tmp.mp3"
  else
    log_fail "failed to create tmp.mp3"
    exit 1
  fi

  # create the merged audio with chapters
  log_info "start to create merged audio"
  ffmpeg -i ./mp3/tmp.mp3 -i "$CHAPTER_TEXT_FILE" -map_metadata 1 -c copy "$MERGE_AUDIO_FILE"
  if [ -f "${MERGE_AUDIO_FILE}" ]; then
    log_success "finish to create ${MERGE_AUDIO_FILE}"
  else
    log_fail "failed to create ${MERGE_AUDIO_FILE}"
    exit 1
  fi
else
  log_fail "ffmpeg command not found"
  exit 1
fi
