#!/bin/bash

[[ ! -e dist/proto ]] && mkdir -p dist/proto
cp src/proto/xudrpc_pb.js dist/proto/
cp src/proto/xudrpc_grpc_pb.js dist/proto/
cp src/proto/annotations_pb.js dist/proto/
cp src/proto/annotations_grpc_pb.js dist/proto/

[[ ! -e dist/proto/google/api ]] && mkdir -p dist/proto/google/api
cp src/proto/google/api/http_pb.js dist/proto/google/api
cp src/proto/google/api/http_grpc_pb.js dist/proto/google/api

[[ ! -e dist/proto/google/protobuf ]] && mkdir -p dist/proto/google/protobuf
cp src/proto/google/protobuf/descriptor_pb.js dist/proto/google/protobuf
cp src/proto/google/protobuf/descriptor_grpc_pb.js dist/proto/google/protobuf
