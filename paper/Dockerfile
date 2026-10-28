FROM gradle:9.2.1-jdk25 AS build
WORKDIR /workspace
COPY paper-plugin/ ./paper-plugin/
RUN gradle -p paper-plugin --no-daemon clean build

FROM alpine:3.22
COPY --from=build /workspace/paper-plugin/build/libs/mka-vote-1.0.0.jar /opt/MKAVote.jar
CMD ["sh","-ec","cp /opt/MKAVote.jar /out/MKAVote.jar && echo 'Installed MKAVote.jar'"]
